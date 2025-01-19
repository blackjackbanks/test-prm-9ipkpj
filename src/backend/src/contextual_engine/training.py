"""
Enhanced training module for COREos Contextual Engine's Llama models.
Implements distributed training, performance optimization, and comprehensive monitoring.

Version: 1.0.0
"""

import torch
import torch.distributed as dist
from torch.cuda.amp import GradScaler, autocast
from transformers import get_linear_schedule_with_warmup
import numpy as np
from typing import Dict, Optional
import logging
from pydantic import dataclasses
from prometheus_client import Gauge, Histogram

from contextual_engine.models import ContextualModel, BusinessAnalysisModel
from contextual_engine.llama_config import LlamaConfig
from utils.cache import RedisCache

# Constants for training configuration
TRAINING_CACHE_PREFIX: str = 'training:'

DEFAULT_TRAINING_PARAMS = {
    'batch_size': 16,
    'learning_rate': 2e-5,
    'num_epochs': 3,
    'warmup_steps': 500,
    'weight_decay': 0.01,
    'gradient_accumulation_steps': 4,
    'max_grad_norm': 1.0,
    'mixed_precision': True,
    'distributed_training': False,
    'num_workers': 4,
    'retry_attempts': 3
}

MAX_TRAINING_SAMPLES: int = 100000

# Prometheus metrics for monitoring
TRAINING_METRICS = {
    'training_loss': Gauge('training_loss', 'Current training loss'),
    'training_progress': Gauge('training_progress', 'Training progress percentage'),
    'gpu_memory_usage': Gauge('gpu_memory_usage', 'GPU memory usage in MB'),
    'training_duration': Histogram('training_duration_seconds', 'Training duration')
}

@dataclasses.dataclass
class TrainingConfig:
    """Enhanced training configuration validator with distributed support."""
    
    model_path: str
    training_params: dict
    model_config: Optional[dict] = None
    distributed_config: Optional[dict] = None

    def __init__(
        self,
        model_path: str,
        training_params: dict,
        model_config: Optional[dict] = None,
        distributed_config: Optional[dict] = None
    ):
        """Initialize enhanced training configuration."""
        self.model_path = model_path
        self.training_params = {**DEFAULT_TRAINING_PARAMS, **training_params}
        self.model_config = model_config or {}
        self.distributed_config = distributed_config or {}
        
        # Validate configuration
        if not self.validate():
            raise ValueError("Invalid training configuration")

    def validate(self) -> bool:
        """Validate training configuration with enhanced checks."""
        try:
            # Validate model path
            if not self.model_path:
                raise ValueError("Model path is required")

            # Validate training parameters
            if self.training_params['batch_size'] < 1:
                raise ValueError("Batch size must be positive")
            if self.training_params['learning_rate'] <= 0:
                raise ValueError("Learning rate must be positive")
            if self.training_params['num_epochs'] < 1:
                raise ValueError("Number of epochs must be positive")

            # Validate distributed configuration
            if self.training_params['distributed_training']:
                if not torch.cuda.is_available():
                    raise ValueError("CUDA required for distributed training")
                if 'world_size' not in self.distributed_config:
                    raise ValueError("World size required for distributed training")

            return True
        except Exception as e:
            logging.error(f"Configuration validation failed: {str(e)}")
            return False

class ModelTrainer:
    """Enhanced model trainer with distributed training and performance optimization."""

    def __init__(
        self,
        model_path: str,
        config: dict,
        distributed_config: Optional[dict] = None
    ):
        """Initialize enhanced model trainer."""
        self._config = TrainingConfig(
            model_path=model_path,
            training_params=config,
            distributed_config=distributed_config
        )
        
        # Initialize components
        self._base_model = None
        self._optimizer = None
        self._scheduler = None
        self._scaler = GradScaler() if self._config.training_params['mixed_precision'] else None
        self._cache = RedisCache()
        
        # Setup distributed training if enabled
        if self._config.training_params['distributed_training']:
            self._setup_distributed_training()
        
        # Initialize model and optimizer
        self._initialize_training_components()
        
        logging.info(f"Initialized ModelTrainer with config: {self._config}")

    def _setup_distributed_training(self):
        """Configure distributed training environment."""
        dist_config = self._config.distributed_config
        dist.init_process_group(
            backend='nccl',
            init_method=dist_config.get('init_method', 'env://'),
            world_size=dist_config['world_size'],
            rank=dist_config.get('rank', 0)
        )

    def _initialize_training_components(self):
        """Initialize model, optimizer, and scheduler with optimization."""
        # Initialize model
        self._base_model = ContextualModel(
            self._config.model_path,
            self._config.model_config
        )
        
        # Configure optimizer with weight decay
        param_groups = [
            {
                'params': [p for n, p in self._base_model._model.named_parameters() 
                          if not any(nd in n for nd in ['bias', 'LayerNorm.weight'])],
                'weight_decay': self._config.training_params['weight_decay']
            },
            {
                'params': [p for n, p in self._base_model._model.named_parameters() 
                          if any(nd in n for nd in ['bias', 'LayerNorm.weight'])],
                'weight_decay': 0.0
            }
        ]
        
        self._optimizer = torch.optim.AdamW(
            param_groups,
            lr=self._config.training_params['learning_rate'],
            eps=1e-8
        )
        
        # Initialize scheduler
        self._scheduler = get_linear_schedule_with_warmup(
            self._optimizer,
            num_warmup_steps=self._config.training_params['warmup_steps'],
            num_training_steps=self._config.training_params['num_epochs']
        )

    async def train(
        self,
        dataset: torch.utils.data.Dataset,
        training_params: Optional[dict] = None
    ) -> dict:
        """Execute enhanced distributed training with performance optimization."""
        try:
            # Update training parameters if provided
            if training_params:
                self._config.training_params.update(training_params)

            # Setup data loader with distributed sampler if needed
            sampler = torch.utils.data.DistributedSampler(dataset) if self._config.training_params['distributed_training'] else None
            
            dataloader = torch.utils.data.DataLoader(
                dataset,
                batch_size=self._config.training_params['batch_size'],
                sampler=sampler,
                num_workers=self._config.training_params['num_workers'],
                pin_memory=True
            )

            # Training loop
            best_loss = float('inf')
            training_stats = []
            
            for epoch in range(self._config.training_params['num_epochs']):
                epoch_loss = await self._train_epoch(dataloader, epoch)
                training_stats.append({'epoch': epoch, 'loss': epoch_loss})
                
                # Update metrics
                TRAINING_METRICS['training_loss'].set(epoch_loss)
                TRAINING_METRICS['training_progress'].set(
                    (epoch + 1) / self._config.training_params['num_epochs'] * 100
                )
                
                # Save checkpoint if best loss
                if epoch_loss < best_loss:
                    best_loss = epoch_loss
                    await self.save_checkpoint(
                        f"{self._config.model_path}_best",
                        {'epoch': epoch, 'loss': epoch_loss}
                    )

            return {
                'training_stats': training_stats,
                'best_loss': best_loss,
                'model_path': self._config.model_path
            }

        except Exception as e:
            logging.error(f"Training error: {str(e)}")
            raise

    async def _train_epoch(self, dataloader: torch.utils.data.DataLoader, epoch: int) -> float:
        """Execute single training epoch with optimization."""
        self._base_model._model.train()
        total_loss = 0
        accumulated_loss = 0
        
        for step, batch in enumerate(dataloader):
            try:
                with autocast(enabled=self._config.training_params['mixed_precision']):
                    # Forward pass
                    outputs = self._base_model._model(**batch)
                    loss = outputs.loss / self._config.training_params['gradient_accumulation_steps']
                    
                    # Backward pass with gradient accumulation
                    if self._scaler:
                        self._scaler.scale(loss).backward()
                    else:
                        loss.backward()
                        
                    accumulated_loss += loss.item()
                    
                    # Update weights if gradient accumulation steps reached
                    if (step + 1) % self._config.training_params['gradient_accumulation_steps'] == 0:
                        if self._scaler:
                            self._scaler.unscale_(self._optimizer)
                            
                        torch.nn.utils.clip_grad_norm_(
                            self._base_model._model.parameters(),
                            self._config.training_params['max_grad_norm']
                        )
                        
                        if self._scaler:
                            self._scaler.step(self._optimizer)
                            self._scaler.update()
                        else:
                            self._optimizer.step()
                            
                        self._scheduler.step()
                        self._optimizer.zero_grad()
                        
                        total_loss += accumulated_loss
                        accumulated_loss = 0
                        
                        # Update GPU memory usage metric
                        if torch.cuda.is_available():
                            TRAINING_METRICS['gpu_memory_usage'].set(
                                torch.cuda.max_memory_allocated() / 1024 / 1024
                            )

            except Exception as e:
                logging.error(f"Error in training step {step}, epoch {epoch}: {str(e)}")
                continue

        return total_loss / len(dataloader)

    async def evaluate(self, eval_dataset: torch.utils.data.Dataset) -> dict:
        """Perform enhanced distributed evaluation."""
        try:
            eval_sampler = torch.utils.data.DistributedSampler(eval_dataset) if self._config.training_params['distributed_training'] else None
            
            eval_dataloader = torch.utils.data.DataLoader(
                eval_dataset,
                batch_size=self._config.training_params['batch_size'],
                sampler=eval_sampler,
                num_workers=self._config.training_params['num_workers'],
                pin_memory=True
            )

            self._base_model._model.eval()
            total_eval_loss = 0
            
            with torch.no_grad():
                for batch in eval_dataloader:
                    outputs = self._base_model._model(**batch)
                    total_eval_loss += outputs.loss.item()

            avg_eval_loss = total_eval_loss / len(eval_dataloader)
            
            # Cache evaluation results
            await self._cache.set(
                f"{TRAINING_CACHE_PREFIX}eval:{self._config.model_path}",
                {'loss': avg_eval_loss},
                3600
            )

            return {'eval_loss': avg_eval_loss}

        except Exception as e:
            logging.error(f"Evaluation error: {str(e)}")
            raise

    async def save_checkpoint(self, checkpoint_path: str, training_state: dict) -> bool:
        """Save enhanced distributed checkpoint."""
        try:
            async with self._cache.distributed_lock(f"{TRAINING_CACHE_PREFIX}checkpoint_lock"):
                # Save model state
                model_state = {
                    'model_state_dict': self._base_model._model.state_dict(),
                    'optimizer_state_dict': self._optimizer.state_dict(),
                    'scheduler_state_dict': self._scheduler.state_dict(),
                    'training_state': training_state,
                    'config': self._config.__dict__,
                    'scaler_state_dict': self._scaler.state_dict() if self._scaler else None
                }
                
                torch.save(model_state, checkpoint_path)
                return True

        except Exception as e:
            logging.error(f"Checkpoint save error: {str(e)}")
            return False

    async def load_checkpoint(self, checkpoint_path: str) -> dict:
        """Load enhanced distributed checkpoint."""
        try:
            async with self._cache.distributed_lock(f"{TRAINING_CACHE_PREFIX}checkpoint_lock"):
                checkpoint = torch.load(checkpoint_path)
                
                # Load model state
                self._base_model._model.load_state_dict(checkpoint['model_state_dict'])
                self._optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
                self._scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
                
                if self._scaler and 'scaler_state_dict' in checkpoint:
                    self._scaler.load_state_dict(checkpoint['scaler_state_dict'])
                
                return checkpoint['training_state']

        except Exception as e:
            logging.error(f"Checkpoint load error: {str(e)}")
            raise