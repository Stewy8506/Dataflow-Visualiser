import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkspaceBreadcrumb } from './WorkspaceBreadcrumb';

describe('WorkspaceBreadcrumb', () => {
  it('renders correctly with a short path', () => {
    render(<WorkspaceBreadcrumb path="/User/projects/app" onChangeDirectory={() => {}} />);
    
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('projects')).toBeInTheDocument();
    expect(screen.getByText('app')).toBeInTheDocument();
  });

  it('clips long paths and shows only the last 3 segments', () => {
    render(<WorkspaceBreadcrumb path="/User/very/long/path/to/my/app" onChangeDirectory={() => {}} />);
    
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.getByText('to')).toBeInTheDocument();
    expect(screen.getByText('my')).toBeInTheDocument();
    expect(screen.getByText('app')).toBeInTheDocument();
    expect(screen.queryByText('long')).not.toBeInTheDocument();
  });

  it('fires onChangeDirectory when Change button is clicked', () => {
    const handleChange = vi.fn();
    render(<WorkspaceBreadcrumb path="/app" onChangeDirectory={handleChange} />);
    
    const button = screen.getByText('Change');
    fireEvent.click(button);
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
