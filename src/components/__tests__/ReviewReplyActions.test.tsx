import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewReplyActions } from '../ReviewReplyActions';

describe('review reply actions', () => {
  it('opens edit directly but never deletes before explicit confirmation', async () => {
    const edit = vi.fn();
    const remove = vi.fn().mockResolvedValue(true);
    render(<ReviewReplyActions onEdit={edit} onDelete={remove} removesThread />);
    fireEvent.click(screen.getByRole('button', { name: 'Redigera svar' }));
    expect(edit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort svar' }));
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveTextContent('alla efterföljande inlägg');
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort svar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort', exact: true }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
  it('keeps failed deletion open for retry', async () => {
    render(<ReviewReplyActions onDelete={vi.fn().mockResolvedValue(false)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort svar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort', exact: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ta bort', exact: true })).not.toBeDisabled());
    expect(screen.getByRole('alertdialog')).toBeVisible();
  });
});