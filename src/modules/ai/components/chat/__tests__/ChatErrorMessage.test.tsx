import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatErrorMessage } from '../ChatErrorMessage';

describe('ChatErrorMessage', () => {
  const defaultError = {
    code: 'OPERATION_FAILED',
    message: 'Something went wrong',
    timestamp: '2024-01-30T12:00:00Z',
  };

  const defaultProps = {
    error: defaultError,
    onRetry: jest.fn(),
    onRollback: jest.fn(),
    onStartNewChat: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders validation error correctly', () => {
    render(
      <ChatErrorMessage
        {...defaultProps}
        error={{
          ...defaultError,
          code: 'VALIDATION_ERROR',
        }}
      />
    );

    expect(screen.getByText('Invalid Operation')).toBeInTheDocument();
    expect(screen.getByText(/validation errors/)).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders permission denied error correctly', () => {
    render(
      <ChatErrorMessage
        {...defaultProps}
        error={{
          ...defaultError,
          code: 'PERMISSION_DENIED',
        }}
      />
    );

    expect(screen.getByText('Permission Denied')).toBeInTheDocument();
    expect(screen.getByText(/do not have permission/)).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders network error correctly', () => {
    render(
      <ChatErrorMessage
        {...defaultProps}
        error={{
          ...defaultError,
          code: 'NETWORK_ERROR',
        }}
      />
    );

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText(/check your connection/)).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders error details when provided', () => {
    render(
      <ChatErrorMessage
        {...defaultProps}
        error={{
          ...defaultError,
          details: { field: 'username', reason: 'required' },
        }}
      />
    );

    expect(screen.getByText(/username/)).toBeInTheDocument();
    expect(screen.getByText(/required/)).toBeInTheDocument();
  });

  it('shows timestamp when provided', () => {
    render(<ChatErrorMessage {...defaultProps} />);

    const date = new Date(defaultError.timestamp).toLocaleString();
    expect(screen.getByText(date)).toBeInTheDocument();
  });

  it('renders all action buttons when handlers provided', () => {
    render(<ChatErrorMessage {...defaultProps} />);

    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Undo Last Action')).toBeInTheDocument();
    expect(screen.getByText('Start New Chat')).toBeInTheDocument();
  });

  it('calls correct handler when action buttons clicked', () => {
    render(<ChatErrorMessage {...defaultProps} />);

    fireEvent.click(screen.getByText('Try Again'));
    expect(defaultProps.onRetry).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Undo Last Action'));
    expect(defaultProps.onRollback).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Start New Chat'));
    expect(defaultProps.onStartNewChat).toHaveBeenCalled();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    render(<ChatErrorMessage {...defaultProps} />);

    fireEvent.click(screen.getByText('Dismiss'));
    expect(defaultProps.onDismiss).toHaveBeenCalled();
  });

  it('does not render action buttons when handlers not provided', () => {
    render(
      <ChatErrorMessage
        error={defaultError}
      />
    );

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    expect(screen.queryByText('Undo Last Action')).not.toBeInTheDocument();
    expect(screen.queryByText('Start New Chat')).not.toBeInTheDocument();
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
  });
}); 