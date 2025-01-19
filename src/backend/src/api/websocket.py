"""
WebSocket implementation for real-time communication in the COREos platform.
Provides secure, scalable, and performant real-time messaging with support for 
chat interface, live updates, and AI processing streams.

Version: 1.0.0
"""

from typing import Dict, Optional, Set, List
import asyncio
import logging
from datetime import datetime
import json

from fastapi import WebSocket, WebSocketDisconnect  # version: 0.100.0
from redis import Redis  # version: 4.5.0
from prometheus_client import Counter  # version: 0.16.0

from security.authentication import AuthenticationManager
from services.context_service import ContextService
from utils.exceptions import AuthenticationException
from utils.constants import ErrorCodes

# Constants
PING_INTERVAL = 30  # Heartbeat interval in seconds
MAX_CONNECTIONS_PER_USER = 5  # Maximum concurrent connections per user
RATE_LIMIT_WINDOW = 60  # Rate limit window in seconds
MAX_MESSAGE_SIZE = 1024 * 1024  # 1MB maximum message size
BATCH_SIZE = 100  # Batch size for message processing

# Prometheus metrics
connection_metrics = Counter('websocket_connections_total', 'Total WebSocket connections')
message_metrics = Counter('websocket_messages_total', 'Total WebSocket messages')
error_metrics = Counter('websocket_errors_total', 'Total WebSocket errors')

# Configure logging
logger = logging.getLogger(__name__)

class WebSocketManager:
    """
    Enhanced WebSocket connection manager with Redis-based tracking,
    connection pooling, and performance monitoring.
    """

    def __init__(
        self,
        redis_manager: Redis,
        auth_manager: AuthenticationManager,
        context_service: ContextService
    ):
        """Initialize WebSocket manager with enhanced capabilities."""
        self._redis_manager = redis_manager
        self._auth_manager = auth_manager
        self._context_service = context_service
        
        # Connection tracking
        self._active_connections: Dict[str, Set[WebSocket]] = {}
        self._user_connections: Dict[str, Set[WebSocket]] = {}
        
        # Performance monitoring
        self._metrics = {
            "connections": connection_metrics,
            "messages": message_metrics,
            "errors": error_metrics
        }
        
        logger.info("Initialized WebSocketManager with enhanced capabilities")

    async def authenticate_connection(
        self,
        websocket: WebSocket,
        token: str,
        security_context: Dict
    ) -> Dict:
        """
        Enhanced WebSocket connection authentication with rate limiting and security checks.
        
        Args:
            websocket: WebSocket connection
            token: Authentication token
            security_context: Additional security context
            
        Returns:
            Dict: Validated user data with security context
            
        Raises:
            AuthenticationException: If authentication fails
        """
        try:
            # Validate JWT token
            user_data = await self._auth_manager.validate_token(token)
            
            # Check rate limits
            user_id = user_data["sub"]
            if user_id in self._user_connections:
                if len(self._user_connections[user_id]) >= MAX_CONNECTIONS_PER_USER:
                    raise AuthenticationException(
                        message="Maximum connections exceeded",
                        error_code=ErrorCodes.RATE_LIMITED.value
                    )
            
            # Verify connection security
            await self._auth_manager.verify_connection_security(security_context)
            
            # Initialize connection tracking
            if user_id not in self._user_connections:
                self._user_connections[user_id] = set()
            
            # Update metrics
            self._metrics["connections"].inc()
            
            return user_data
            
        except Exception as e:
            logger.error(f"Connection authentication failed: {str(e)}")
            raise AuthenticationException(
                message="Authentication failed",
                error_code=ErrorCodes.AUTH_FAILED.value
            )

    async def handle_connection(
        self,
        websocket: WebSocket,
        token: str,
        context: Dict
    ) -> None:
        """
        Handle WebSocket connection with enhanced error handling and monitoring.
        
        Args:
            websocket: WebSocket connection
            token: Authentication token
            context: Connection context
        """
        user_data = None
        
        try:
            # Authenticate connection
            user_data = await self.authenticate_connection(websocket, token, context)
            user_id = user_data["sub"]
            
            # Accept connection
            await websocket.accept()
            
            # Add to connection tracking
            self._user_connections[user_id].add(websocket)
            
            # Start heartbeat
            heartbeat_task = asyncio.create_task(self._heartbeat(websocket))
            
            # Process messages
            try:
                while True:
                    message = await websocket.receive_json()
                    
                    # Validate message size
                    if len(json.dumps(message)) > MAX_MESSAGE_SIZE:
                        await self._send_error(
                            websocket,
                            "Message size exceeds limit",
                            ErrorCodes.RATE_LIMITED.value
                        )
                        continue
                    
                    # Process message
                    await self._process_message(websocket, message, user_data)
                    
                    # Update metrics
                    self._metrics["messages"].inc()
                    
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected: {user_id}")
            finally:
                # Cleanup
                heartbeat_task.cancel()
                await self.cleanup_connection(websocket, user_id)
                
        except AuthenticationException as e:
            logger.error(f"Authentication failed: {str(e)}")
            if websocket.client_state.connected:
                await websocket.close(code=4001, reason=str(e))
        except Exception as e:
            logger.error(f"Connection error: {str(e)}")
            self._metrics["errors"].inc()
            if websocket.client_state.connected:
                await websocket.close(code=1011, reason="Internal server error")
        finally:
            # Final cleanup if needed
            if user_data and websocket in self._user_connections.get(user_data["sub"], set()):
                await self.cleanup_connection(websocket, user_data["sub"])

    async def cleanup_connection(self, websocket: WebSocket, user_id: str) -> None:
        """
        Clean up connection resources and tracking.
        
        Args:
            websocket: WebSocket connection to clean up
            user_id: User identifier
        """
        try:
            # Remove from user connections
            if user_id in self._user_connections:
                self._user_connections[user_id].discard(websocket)
                if not self._user_connections[user_id]:
                    del self._user_connections[user_id]
            
            # Close connection if still open
            if websocket.client_state.connected:
                await websocket.close()
                
        except Exception as e:
            logger.error(f"Cleanup error: {str(e)}")

    async def _heartbeat(self, websocket: WebSocket) -> None:
        """Maintain connection with periodic heartbeats."""
        try:
            while True:
                await asyncio.sleep(PING_INTERVAL)
                await websocket.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
        except Exception as e:
            logger.error(f"Heartbeat error: {str(e)}")

    async def _process_message(
        self,
        websocket: WebSocket,
        message: Dict,
        user_data: Dict
    ) -> None:
        """
        Process incoming WebSocket messages with context awareness.
        
        Args:
            websocket: WebSocket connection
            message: Message to process
            user_data: User context data
        """
        try:
            message_type = message.get("type", "")
            
            if message_type == "chat":
                # Process chat message with context
                context_result = await self._context_service.process_context(
                    user_data["organization_id"],
                    message["content"],
                    message.get("params", {})
                )
                await websocket.send_json({
                    "type": "chat_response",
                    "content": context_result.content,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            elif message_type == "context_update":
                # Handle context updates
                await self._context_service.cache_context(
                    user_data["organization_id"],
                    message["context"]
                )
                await websocket.send_json({
                    "type": "context_updated",
                    "timestamp": datetime.utcnow().isoformat()
                })
                
            else:
                await self._send_error(
                    websocket,
                    "Unsupported message type",
                    ErrorCodes.VALIDATION_ERROR.value
                )
                
        except Exception as e:
            logger.error(f"Message processing error: {str(e)}")
            await self._send_error(
                websocket,
                "Failed to process message",
                ErrorCodes.INTERNAL_ERROR.value
            )

    async def _send_error(
        self,
        websocket: WebSocket,
        message: str,
        error_code: str
    ) -> None:
        """Send error message to client."""
        try:
            await websocket.send_json({
                "type": "error",
                "message": message,
                "code": error_code,
                "timestamp": datetime.utcnow().isoformat()
            })
            self._metrics["errors"].inc()
        except Exception as e:
            logger.error(f"Error sending error message: {str(e)}")