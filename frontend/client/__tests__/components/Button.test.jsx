import { render, screen } from '@testing-library/react';
import Button from '@/components/Button';

it('renders a disabled button with its accessible name', () => {
    render(<Button type="primary" disabled>Weiter</Button>);

    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
});
