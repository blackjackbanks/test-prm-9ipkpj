"""
Package initializer for COREos Contextual Engine.
Provides high-performance AI model components, inference engine, and context processing functionality.

Version: 1.0.0
"""

from contextual_engine.models import ContextualModel, BusinessAnalysisModel
from contextual_engine.llama_config import LlamaConfig
from contextual_engine.inference import InferenceEngine, InferenceRequest
from contextual_engine.processor import ContextProcessor, ContextRequest

# Package version
VERSION = '1.0.0'

# Default model configuration
DEFAULT_MODEL_PATH = 'llama-2-7b'
MAX_INFERENCE_TIME = 3.0  # Maximum inference time in seconds
MODEL_CACHE_SIZE = 2  # Number of models to keep in memory

# Export public interface
__all__ = [
    # Core model components
    'ContextualModel',
    'BusinessAnalysisModel',
    'LlamaConfig',
    
    # Inference components
    'InferenceEngine',
    'InferenceRequest',
    
    # Processing components
    'ContextProcessor',
    'ContextRequest',
    
    # Constants
    'VERSION',
    'DEFAULT_MODEL_PATH',
    'MAX_INFERENCE_TIME',
    'MODEL_CACHE_SIZE'
]

# Package metadata
__version__ = VERSION
__author__ = 'COREos Team'
__description__ = 'AI-driven business analysis and decision support engine'

# Initialize package-level logger
import logging
logging.getLogger(__name__).addHandler(logging.NullHandler())

def get_model_info() -> dict:
    """
    Returns information about the default model configuration.
    
    Returns:
        dict: Model configuration information
    """
    return {
        'model_path': DEFAULT_MODEL_PATH,
        'max_inference_time': MAX_INFERENCE_TIME,
        'cache_size': MODEL_CACHE_SIZE,
        'version': VERSION
    }

def validate_environment() -> bool:
    """
    Validates the runtime environment for model operation.
    
    Returns:
        bool: True if environment is valid, False otherwise
    """
    import torch
    
    # Check CUDA availability
    cuda_available = torch.cuda.is_available()
    if not cuda_available:
        logging.warning("CUDA not available - running on CPU may impact performance")
    
    # Validate model path
    config = LlamaConfig(model_path=DEFAULT_MODEL_PATH)
    try:
        config.validate_config(config.model_config)
    except ValueError as e:
        logging.error(f"Model configuration validation failed: {str(e)}")
        return False
    
    return True

# Perform environment validation on import
if not validate_environment():
    logging.warning("Environment validation failed - some features may be limited")