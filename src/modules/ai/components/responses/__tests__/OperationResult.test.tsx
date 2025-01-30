import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationResult } from '../OperationResult';
import { ArrowLeft } from 'lucide-react';

describe('OperationResult', () => {
  const defaultProps = {
    status: 'success' as const,
    title: 'Operation Complete',
    message: 'The operation was successful',
  };

  it('renders success state correctly', () => {
    render(<OperationResult {...defaultProps} />);
    
    expect(screen.getByText('Operation Complete')).toBeInTheDocument();
    expect(screen.getByText('The operation was successful')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    render(
      <OperationResult
        {...defaultProps}
        status="error"
        title="Operation Failed"
        message="Something went wrong"
      />
    );
    
    expect(screen.getByText('Operation Failed')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders warning state correctly', () => {
    render(
      <OperationResult
        {...defaultProps}
        status="warning"
        title="Partial Success"
        message="Operation completed with warnings"
      />
    );
    
    expect(screen.getByText('Partial Success')).toBeInTheDocument();
    expect(screen.getByText('Operation completed with warnings')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('displays details when provided', () => {
    const details = JSON.stringify({ error: 'Details about the error' }, null, 2);
    render(<OperationResult {...defaultProps} details={details} />);
    
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText(/Details about the error/)).toBeInTheDocument();
  });

  it('shows timestamp when provided', () => {
    const timestamp = '2024-01-30T12:00:00Z';
    render(<OperationResult {...defaultProps} timestamp={timestamp} />);
    
    const date = new Date(timestamp).toLocaleString();
    expect(screen.getByText(date)).toBeInTheDocument();
  });

  it('renders actions correctly', () => {
    const actions = [
      {
        label: 'Retry',
        onClick: jest.fn(),
        variant: 'default' as const,
      },
      {
        label: 'Go Back',
        onClick: jest.fn(),
        icon: <ArrowLeft className="h-4 w-4" />,
        variant: 'ghost' as const,
      },
    ];

    render(<OperationResult {...defaultProps} actions={actions} />);
    
    const retryButton = screen.getByText('Retry');
    const backButton = screen.getByText('Go Back');
    
    expect(retryButton).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    fireEvent.click(backButton);
    
    expect(actions[0].onClick).toHaveBeenCalled();
    expect(actions[1].onClick).toHaveBeenCalled();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = jest.fn();
    render(<OperationResult {...defaultProps} onDismiss={onDismiss} />);
    
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not render footer when no actions or dismiss', () => {
    const { container } = render(<OperationResult {...defaultProps} />);
    expect(container.querySelector('.border-t')).not.toBeInTheDocument();
  });

  it('applies correct status colors', () => {
    const { rerender } = render(<OperationResult {...defaultProps} />);
    expect(screen.getByText('Success')).toHaveClass('bg-green-500/10');

    rerender(<OperationResult {...defaultProps} status="error" />);
    expect(screen.getByText('Error')).toHaveClass('bg-red-500/10');

    rerender(<OperationResult {...defaultProps} status="warning" />);
    expect(screen.getByText('Warning')).toHaveClass('bg-yellow-500/10');
  });
}); 