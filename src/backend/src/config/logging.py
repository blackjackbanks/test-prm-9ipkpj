"""
Logging configuration module for COREos backend application.
Implements structured logging with distributed tracing, performance monitoring,
and cloud integration for comprehensive system observability.

Version: 1.0.0
"""

import logging  # v3.11+
import structlog  # v23.1.0
import watchtower  # v3.0.1
from opentelemetry import trace  # v1.19.0
from opentelemetry.trace import SpanKind, Status, StatusCode
from prometheus_client import Counter, Histogram  # v0.17.1

from config.settings import ENV_STATE, DEBUG, AWS_REGION
from utils.constants import ErrorCodes

# Base logging configuration
LOG_LEVEL = 'INFO' if not DEBUG else 'DEBUG'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

# Structured JSON log format
JSON_LOG_FORMAT = {
    'timestamp': '%(asctime)s',
    'service': 'coreos-backend',
    'level': '%(levelname)s',
    'message': '%(message)s',
    'trace_id': '%(trace_id)s',
    'span_id': '%(span_id)s',
    'environment': ENV_STATE
}

# CloudWatch configuration
CLOUDWATCH_LOG_GROUP = f'/coreos/{ENV_STATE}/application'
RETENTION_DAYS = 90 if ENV_STATE == 'production' else 30

# Prometheus metrics
log_events = Counter(
    'log_events_total',
    'Total number of log events by level',
    ['level', 'service']
)

log_latency = Histogram(
    'log_processing_seconds',
    'Log processing latency in seconds',
    ['service']
)

class RequestIdFilter(logging.Filter):
    """
    Logging filter that adds request ID and trace context to log records.
    Enables distributed tracing and request correlation across services.
    """
    
    def __init__(self, request_id: str, trace_id: str, span_id: str):
        """Initialize filter with request and trace context."""
        super().__init__()
        self.request_id = request_id
        self.trace_id = trace_id
        self.span_id = span_id

    def filter(self, record: logging.LogRecord) -> bool:
        """Add request ID and trace context to log record."""
        record.request_id = self.request_id
        record.trace_id = self.trace_id
        record.span_id = self.span_id
        
        # Sanitize sensitive data
        if hasattr(record, 'msg'):
            record.msg = self._sanitize_pii(record.msg)
            
        return True

    def _sanitize_pii(self, message: str) -> str:
        """Sanitize potentially sensitive information from log messages."""
        # Add PII sanitization logic here
        return message

def get_request_id_context() -> dict:
    """
    Extract request ID and trace context for correlation.
    Integrates with OpenTelemetry for distributed tracing.
    """
    tracer = trace.get_tracer(__name__)
    current_span = trace.get_current_span()
    span_context = current_span.get_span_context()
    
    return {
        'request_id': getattr(current_span, 'request_id', ''),
        'trace_id': format(span_context.trace_id, '016x'),
        'span_id': format(span_context.span_id, '016x')
    }

def setup_logging(service_name: str, extra_context: dict = None) -> logging.Logger:
    """
    Configure comprehensive logging with structured output and monitoring.
    
    Args:
        service_name: Name of the service for identification
        extra_context: Additional context to include in logs
        
    Returns:
        logging.Logger: Configured logger instance
    """
    # Base configuration
    logging.basicConfig(level=getattr(logging, LOG_LEVEL))
    logger = logging.getLogger(service_name)
    
    # Structured logging processors
    processors = [
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    # Console handler with JSON formatting
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            processor=structlog.processors.JSONRenderer(),
            foreign_pre_chain=processors
        )
    )
    logger.addHandler(console_handler)

    # File handler for error logging
    if ENV_STATE == 'production':
        error_handler = logging.handlers.RotatingFileHandler(
            filename=f'/var/log/coreos/{service_name}-error.log',
            maxBytes=10485760,  # 10MB
            backupCount=5
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(error_handler)

    # CloudWatch integration
    if ENV_STATE in ['staging', 'production']:
        cloudwatch_handler = watchtower.CloudWatchLogHandler(
            log_group=CLOUDWATCH_LOG_GROUP,
            stream_name=service_name,
            retention_days=RETENTION_DAYS,
            create_log_group=True,
            region=AWS_REGION,
            send_interval=10,  # seconds
            max_batch_size=100,
            max_batch_count=10
        )
        logger.addHandler(cloudwatch_handler)

    # Add request context filter
    context = get_request_id_context()
    request_filter = RequestIdFilter(
        request_id=context['request_id'],
        trace_id=context['trace_id'],
        span_id=context['span_id']
    )
    logger.addFilter(request_filter)

    # Configure structlog
    structlog.configure(
        processors=processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Add extra context if provided
    if extra_context:
        logger = logger.bind(**extra_context)

    # Log startup message
    logger.info(
        "Logging configured",
        service=service_name,
        level=LOG_LEVEL,
        environment=ENV_STATE
    )

    return logger