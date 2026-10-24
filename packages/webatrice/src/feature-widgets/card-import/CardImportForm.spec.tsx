import { fireEvent, screen, waitFor } from '@testing-library/react';

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
  review: null as never,
  result: null as never,
  answerUnknownSets: vi.fn(),
  error: null as string | null,
  handleBack: vi.fn(),
  handleLocalFiles: vi.fn(),
  handleLocalSave: vi.fn(),
};

describe('CardImportForm', () => {
  it('renders the dropzone import step first, with the desktop data folders', () => {
    hoisted.useCardImportForm.mockReturnValue({ ...baseHook });

    renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);

    expect(screen.getByText('%LOCALAPPDATA%\\Cockatrice\\Cockatrice')).toBeInTheDocument();
    expect(screen.getByText('~/Library/Application Support/Cockatrice/Cockatrice')).toBeInTheDocument();
    expect(screen.getByText('~/.local/share/Cockatrice/Cockatrice')).toBeInTheDocument();
    expect(screen.getByText('CardImportForm.message.customSetsHelp')).toBeInTheDocument();

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
      review: {
        cards: 2, sets: 1, tokens: 0, formats: 0,
        setNames: ['A Set'],
        files: [{ name: 'cards.xml', kind: 'main' }, { name: 'Cube.xml', kind: 'custom' }],
        problems: ['ImportSummary.problem.unsupported.cardFiles'],
      },
    });

    renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);

    expect(screen.getByText('CardImportForm.message.acceptedFiles')).toBeInTheDocument();
    expect(screen.getByText('ImportSummary.problem.unsupported.cardFiles')).toBeInTheDocument();

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
      handleBack,
      handleLocalSave,
    });

    renderWithProviders(<CardImportForm onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'CardImportForm.button.save' }));
    fireEvent.click(screen.getByRole('button', { name: 'CardImportForm.button.goBack' }));
    expect(handleLocalSave).toHaveBeenCalled();
    expect(handleBack).toHaveBeenCalled();
  });

  it('renders the finished step with the import summary and wires the done button to onSubmit', () => {
    hoisted.useCardImportForm.mockReturnValue({
      ...baseHook,
      activeStep: 2,
      result: {
        text: { headline: 'Imported 1 card file.', problems: ['Not XML files, skipped: notes.txt'], severity: 'warning' },
        unknownSets: [],
      },
    });
    const onSubmit = vi.fn();

    renderWithProviders(<CardImportForm onSubmit={onSubmit} />);

    expect(screen.getByText('Imported 1 card file.')).toBeInTheDocument();
    expect(screen.getByText('Not XML files, skipped: notes.txt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CardImportForm.button.done' }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('asks about new sets after saving and hands "View sets" to the host', async () => {
    const answerUnknownSets = vi.fn().mockResolvedValue(undefined);
    hoisted.useCardImportForm.mockReturnValue({
      ...baseHook,
      activeStep: 2,
      result: { text: { headline: '', problems: [], severity: 'info' }, unknownSets: ['NEO'] },
      answerUnknownSets,
    });
    const onViewSets = vi.fn();

    renderWithProviders(<CardImportForm onSubmit={vi.fn()} onViewSets={onViewSets} />);

    fireEvent.click(screen.getByRole('button', { name: 'CardDatabaseOverview.newSets.view' }));
    await waitFor(() => expect(onViewSets).toHaveBeenCalled());
    expect(answerUnknownSets).toHaveBeenCalledWith('keep-disabled');
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
