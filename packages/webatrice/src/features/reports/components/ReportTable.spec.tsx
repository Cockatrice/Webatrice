import { fireEvent, screen, within } from '@testing-library/react';

import { renderWithProviders } from '../../../__test-utils__';
import { makeReport } from '../__mocks__/reportState';
import ReportTable, { MY_REPORT_COLUMNS, QUEUE_COLUMNS } from './ReportTable';

const rows = [
  makeReport({ reportId: 2, reportedUserName: 'zed', category: 'bug_abuse', status: 'open', gameId: 12, roomId: 1 }),
  makeReport({ reportId: 5, reportedUserName: 'amy', category: 'spam', status: 'resolved', replayId: 3 }),
];

function rowIds() {
  return screen.getAllByTestId(/^report-row-/).map((row) => row.getAttribute('data-testid'));
}

describe('ReportTable', () => {
  it('renders the My Reports columns with the category, status and assignee', () => {
    renderWithProviders(<ReportTable reports={rows} columns={MY_REPORT_COLUMNS} selectedId={null} onSelect={vi.fn()} label="Reports" />);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      MY_REPORT_COLUMNS.map((c) => `Reports.column.${c}`),
    );
    const first = within(screen.getByTestId('report-row-2'));
    expect(first.getByText('#2')).toBeTruthy();
    expect(first.getByText('bug_abuse')).toBeTruthy();
    expect(first.getByText('open')).toBeTruthy();
    expect(first.getByText('Reports.column.nobody')).toBeTruthy();
  });

  it('shows the age of each report and the queue columns in desktop order', () => {
    renderWithProviders(<ReportTable reports={rows} columns={QUEUE_COLUMNS} selectedId={null} onSelect={vi.fn()} label="Reports" />);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(QUEUE_COLUMNS.map((c) => `Reports.column.${c}`));
    expect(within(screen.getByTestId('report-row-5')).getByText('Reports.age.days')).toBeTruthy();
  });

  it('keeps server order until a header is clicked, then toggles the direction', () => {
    renderWithProviders(<ReportTable reports={rows} columns={MY_REPORT_COLUMNS} selectedId={null} onSelect={vi.fn()} label="Reports" />);
    expect(rowIds()).toEqual(['report-row-2', 'report-row-5']);
    fireEvent.click(screen.getByText('Reports.column.reportedUser'));
    expect(rowIds()).toEqual(['report-row-5', 'report-row-2']);
    fireEvent.click(screen.getByText('Reports.column.reportedUser'));
    expect(rowIds()).toEqual(['report-row-2', 'report-row-5']);
  });

  it('is a keyboard grid: one tab stop on the selected row, arrows and Home/End move the selection', () => {
    const onSelect = vi.fn();
    const { rerender } = renderWithProviders(
      <ReportTable reports={rows} columns={QUEUE_COLUMNS} selectedId={null} onSelect={onSelect} label="Reports" />,
    );
    expect(screen.getByRole('grid')).toBeTruthy();
    expect(screen.getByTestId('report-row-2').tabIndex).toBe(0);
    expect(screen.getByTestId('report-row-5').tabIndex).toBe(-1);

    fireEvent.keyDown(screen.getByTestId('report-row-2'), { key: ' ' });
    expect(onSelect).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(screen.getByTestId('report-row-2'), { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith(5);

    rerender(<ReportTable reports={rows} columns={QUEUE_COLUMNS} selectedId={5} onSelect={onSelect} label="Reports" />);
    expect(screen.getByTestId('report-row-5').tabIndex).toBe(0);
    expect(document.activeElement).toBe(screen.getByTestId('report-row-5'));
    fireEvent.keyDown(screen.getByTestId('report-row-5'), { key: 'Home' });
    expect(onSelect).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(screen.getByTestId('report-row-2'), { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(2);
  });

  it('marks the sorted column for assistive technology', () => {
    renderWithProviders(<ReportTable reports={rows} columns={MY_REPORT_COLUMNS} selectedId={null} onSelect={vi.fn()} label="Reports" />);
    const header = screen.getByText('Reports.column.reportedUser').closest('th')!;
    expect(header.getAttribute('aria-sort')).toBeNull();
    fireEvent.click(screen.getByText('Reports.column.reportedUser'));
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(screen.getByText('Reports.column.reportedUser'));
    expect(header.getAttribute('aria-sort')).toBe('descending');
  });

  it('selects a row on click and marks the selected row', () => {
    const onSelect = vi.fn();
    renderWithProviders(<ReportTable reports={rows} columns={MY_REPORT_COLUMNS} selectedId={5} onSelect={onSelect} label="Reports" />);
    expect(screen.getByTestId('report-row-5').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('report-row-2'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('names the grid', () => {
    renderWithProviders(<ReportTable reports={[]} columns={MY_REPORT_COLUMNS} selectedId={null} onSelect={vi.fn()} label="My reports" />);
    expect(screen.getByRole('grid', { name: 'My reports' })).toBeInTheDocument();
  });
});
