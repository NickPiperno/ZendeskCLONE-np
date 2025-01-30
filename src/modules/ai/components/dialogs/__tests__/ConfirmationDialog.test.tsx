import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationDialog } from '../ConfirmationDialog';

describe('ConfirmationDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Test Title',
    description: 'Test Description',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders warning type correctly', () => {
    render(<ConfirmationDialog {...defaultProps} type="warning" />);
    
    const button = screen.getByText('Confirm');
    expect(button).toHaveClass('bg-yellow-500');
  });

  it('renders destructive type correctly', () => {
    render(<ConfirmationDialog {...defaultProps} type="destructive" />);
    
    const button = screen.getByText('Confirm');
    expect(button).toHaveClass('bg-red-500');
  });

  it('uses custom button text', () => {
    render(
      <ConfirmationDialog
        {...defaultProps}
        confirmText="Yes, do it"
        cancelText="No, go back"
      />
    );
    
    expect(screen.getByText('Yes, do it')).toBeInTheDocument();
    expect(screen.getByText('No, go back')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ConfirmationDialog {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('Please wait...')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Please wait...')).toBeDisabled();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is clicked', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Confirm'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('does not call handlers when buttons are disabled', () => {
    render(<ConfirmationDialog {...defaultProps} isLoading={true} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Please wait...'));
    
    expect(defaultProps.onClose).not.toHaveBeenCalled();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });
}); 