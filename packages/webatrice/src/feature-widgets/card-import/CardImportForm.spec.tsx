import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({ useCardImportForm: vi.fn() }));

vi.mock('./useCardImportForm', () => ({ useCardImportForm: hoisted.useCardImportForm }));

import CardImportForm from './CardImportForm';

const baseHook = {
  loading: false,
  activeStep: 0,
  steps: [
    { key: 'importFiles', label: 'CardImportForm.steps.importFiles' },
    { key: 'reviewAndSave', label: 'CardImportForm.steps.reviewAndSave' },
    { key: 'finished', label: 'CardImportForm.steps.finished' },
  ],
  importedCards: [] as never[],
  importedSets: [] as never[],
  ingest: null as never,
  error: null as string | null,
  handleBack: vi.fn(),
  handleLocalFiles: vi.fn(),
  handleLocalSave: vi.fn(),
};

describe('CardImportForm', () => {
  it('renders the dropzone import step first', () => {
    hoisted.useCardImportForm.mockReturnValue({ ...baseHook });

    renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);

    expect(screen.getByText('CardImportForm.message.dropzone')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'CardImportForm.button.browseFiles' }),
    ).toBeInTheDocument();
  });

  it('shows an error message on the import step', () => {
    hoisted.useCardImportForm.mockReturnValue({ ...baseHook, error: 'bad file' });

    renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);

    expect(screen.getByText('bad file')).toBeInTheDocument();
  });

  it('renders the review step with a save button and a back button', () => {
    hoisted.useCardImportForm.mockReturnValue({
      ...baseHook,
      activeStep: 1,
      importedCards: [{}, {}] as never,
      importedSets: [
        { name: { value: 'SET' }, longname: { value: 'A Set' } },
      ] as never,
      ingest: {
        tokens: [],
        formats: [],
        acceptedFiles: ['cards.xml'],
        skippedFiles: ['bad.xml'],
      } as never,
    });

    renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'CardImportForm.button.save' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'CardImportForm.button.goBack' }),
    ).toBeInTheDocument();
  });

  it('wires the review step save and back buttons to the hook handlers', () => {
    const handleBack = vi.fn();
    const handleLocalSave = vi.fn();
    hoisted.useCardImportForm.mockReturnValue({
      ...baseHook,
      activeStep: 1,
      ingest: {} as never,
      handleBack,
      handleLocalSave,
    });

    renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'CardImportForm.button.save' }));
    fireEvent.click(screen.getByRole('button', { name: 'CardImportForm.button.goBack' }));
    expect(handleLocalSave).toHaveBeenCalled();
    expect(handleBack).toHaveBeenCalled();
  });

  it('renders the finished step and wires the done button to onSubmit', () => {
    hoisted.useCardImportForm.mockReturnValue({ ...baseHook, activeStep: 2 });
    const onSubmit = vi.fn();

    renderWithProviders(<CardImportForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'CardImportForm.button.done' }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows the loading spinner when loading', () => {
    hoisted.useCardImportForm.mockReturnValue({ ...baseHook, loading: true });

    const { container } = renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);

    expect(container.querySelector('.loading')).toBeInTheDocument();
  });

  it('forwards dropped files to handleLocalFiles', () => {
    const handleLocalFiles = vi.fn();
    hoisted.useCardImportForm.mockReturnValue({ ...baseHook, handleLocalFiles });

    const { container } = renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);
    const dropzone = container.querySelector('.cardImportForm-dropzone') as HTMLElement;
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [new File(['x'], 'cards.xml')] },
    });

    expect(handleLocalFiles).toHaveBeenCalled();
  });
});
