# COREos Web Frontend

Enterprise-grade React/TypeScript application providing an AI-first operating system interface with MacOS-inspired design system.

## Overview

COREos web frontend delivers an intelligent, context-aware interface for business operations with:

- Modern React (v18+) and TypeScript (v5.0+) architecture
- MacOS-inspired design system with dark/light modes
- WCAG 2.1 AA accessibility compliance
- Real-time data synchronization
- AI-powered contextual interactions
- Enterprise-grade security

## Requirements

### System Requirements
- Node.js >= 18.0.0
- npm >= 8.0.0

### Browser Support
- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90

## Getting Started

### Environment Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# .env.local
VITE_API_BASE_URL=<backend-api-url>
VITE_WS_BASE_URL=<websocket-url>
VITE_AUTH_DOMAIN=<auth0-domain>
VITE_AUTH_CLIENT_ID=<auth0-client-id>
```

### Development Commands

```bash
# Start development server
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```

## Project Structure

```
src/
├── assets/              # Static assets (images, fonts, icons)
├── components/
│   ├── common/         # Reusable UI components
│   ├── features/       # Feature-specific components
│   ├── layouts/        # Page layout components
│   └── forms/          # Form components and validation
├── hooks/
│   ├── common/         # Shared custom React hooks
│   ├── auth/           # Authentication hooks
│   └── api/            # API integration hooks
├── services/
│   ├── api/           # API service integrations
│   ├── websocket/     # WebSocket service
│   └── analytics/     # Analytics integration
├── store/
│   ├── slices/        # Redux state slices
│   ├── middleware/    # Custom Redux middleware
│   └── selectors/     # State selectors
└── utils/
    ├── testing/       # Test utilities
    ├── validation/    # Form validation
    └── formatting/    # Data formatting
```

## Development Guidelines

### Code Style

- Follow TypeScript strict mode guidelines
- Use functional components with hooks
- Implement proper error boundaries
- Maintain comprehensive test coverage
- Document complex logic and business rules

### Component Structure

```typescript
// Example component structure
import React from 'react';
import { useAuth } from '@/hooks/auth';
import { ErrorBoundary } from '@/components/common';

interface Props {
  // Define prop types
}

export const Component: React.FC<Props> = ({ ...props }) => {
  // Implementation
};
```

### State Management

- Use Redux Toolkit for global state
- React Query for server state
- Local state with useState/useReducer
- Context for theme/auth state

## Testing Strategy

### Unit Testing
- Jest + React Testing Library
- Component isolation
- Business logic coverage
- Mock external dependencies

### Integration Testing
- API integration tests
- State management flows
- Cross-component interactions

### E2E Testing
- Cypress for critical paths
- User journey validation
- Performance monitoring

### Coverage Requirements
- Statements: >80%
- Branches: >80%
- Functions: >80%
- Lines: >80%

## Security

### Authentication
- OAuth 2.0 + OIDC compliance
- Secure token management
- Session handling
- MFA support

### Data Protection
- HTTPS-only communication
- XSS prevention
- CSRF protection
- Content Security Policy

## Performance

### Optimization Techniques
- Code splitting
- Lazy loading
- Image optimization
- Bundle size monitoring
- Performance budgets

### Metrics
- First Contentful Paint: <1s
- Time to Interactive: <2s
- Lighthouse Score: >90
- Bundle Size: <500KB (initial)

## Deployment

### Build Process
1. Static analysis
2. Unit tests
3. Integration tests
4. Production build
5. E2E tests
6. Bundle analysis

### CI/CD Pipeline
- GitHub Actions integration
- Automated testing
- Environment-specific builds
- Automated deployments

## Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes
4. Add tests
5. Submit pull request
6. Pass code review

## License

Copyright © 2023 COREos. All rights reserved.