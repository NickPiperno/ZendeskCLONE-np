import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationPreview } from '../OperationPreview';

describe('OperationPreview', () => {
  const mockOperation = {
    domain: 'kb' as const,
    operation: 'update_article',
    changes: [
      {
        field: 'title',
        oldValue: 'Old Title',
        newValue: 'New Title'
      },
      {
        field: 'content',
        oldValue: 'Old content',
        newValue: 'Updated content'
      }
    ],
    metadata: {
      updatedBy: 'John Doe',
      timestamp: '2024-01-30T12:00:00Z'
    }
  };

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    operation: mockOperation,
    isLoading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders operation title correctly', () => {
    render(<OperationPreview {...defaultProps} />);
    expect(screen.getByText('Knowledge Base update article')).toBeInTheDocument();
  });

  it('displays all changes with old and new values', () => {
    render(<OperationPreview {...defaultProps} />);
    
    // Check field titles
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();

    // Check old values
    expect(screen.getByText('"Old Title"')).toBeInTheDocument();
    expect(screen.getByText('"Old content"')).toBeInTheDocument();

    // Check new values
    expect(screen.getByText('"New Title"')).toBeInTheDocument();
    expect(screen.getByText('"Updated content"')).toBeInTheDocument();
  });

  it('shows metadata when provided', () => {
    render(<OperationPreview {...defaultProps} />);
    expect(screen.getByText('Additional Information')).toBeInTheDocument();
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<OperationPreview {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<OperationPreview {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirm Changes'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('disables buttons when loading', () => {
    render(<OperationPreview {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Confirming...')).toBeDisabled();
  });

  it('handles operation without metadata', () => {
    const { operation, ...rest } = defaultProps;
    const operationWithoutMetadata = {
      domain: operation.domain,
      operation: operation.operation,
      changes: operation.changes
    };

    render(<OperationPreview {...rest} operation={operationWithoutMetadata} />);
    expect(screen.queryByText('Additional Information')).not.toBeInTheDocument();
  });

  it('handles operation without old values', () => {
    const { operation, ...rest } = defaultProps;
    const operationWithoutOldValues = {
      ...operation,
      changes: [
        {
          field: 'newField',
          newValue: 'Brand new value'
        }
      ]
    };

    render(<OperationPreview {...rest} operation={operationWithoutOldValues} />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('"Brand new value"')).toBeInTheDocument();
  });
}); 
