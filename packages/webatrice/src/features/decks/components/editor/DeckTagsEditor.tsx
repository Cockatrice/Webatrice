import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';

import { tagSuggestions, validateNewTag, type TagValidation } from '../../deckTags';

export interface DeckTagsEditorProps {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}

export function DeckTagsEditor({ tags, onChange }: DeckTagsEditorProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<TagValidation>('ok');
  const suggestions = useMemo(() => tagSuggestions(tags), [tags]);

  const add = () => {
    const verdict = validateNewTag(draft, tags);
    setProblem(verdict);
    if (verdict !== 'ok') {
      return;
    }
    onChange([...tags, draft.trim()]);
    setDraft('');
  };

  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {t('DeckTags.label')}
      </span>
      {tags.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1" aria-label={t('DeckTags.label')}>
          {tags.map((tag) => (
            <li
              key={tag}
              className={[
                'inline-flex items-center gap-1 rounded-full bg-bg-elevated border border-border-subtle',
                'pl-2 pr-1 py-0.5 text-xs text-text-primary',
              ].join(' ')}
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((other) => other !== tag))}
                aria-label={t('DeckTags.remove', { tag })}
                className="rounded-full p-0.5 text-text-muted hover:text-danger"
              >
                <X size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-1 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          type="text"
          value={draft}
          list={listId}
          onChange={(e) => {
            setDraft(e.target.value);
            setProblem('ok');
          }}
          placeholder={t('DeckTags.placeholder')}
          aria-label={t('DeckTags.add')}
          aria-invalid={problem !== 'ok'}
          className="flex-1 min-w-0 rounded-md border border-border-subtle bg-bg-elevated px-2 py-1 text-xs text-text-primary"
        />
        <datalist id={listId}>
          {suggestions.map((tag) => <option key={tag} value={tag} />)}
        </datalist>
        <button
          type="submit"
          title={t('DeckTags.add')}
          aria-label={t('DeckTags.add')}
          className="p-1.5 rounded-md border border-border-subtle text-text-secondary hover:bg-bg-elevated"
        >
          <Plus size={12} />
        </button>
      </form>
      {problem !== 'ok' && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {t(problem === 'empty' ? 'DeckTags.empty' : 'DeckTags.duplicate')}
        </p>
      )}
    </div>
  );
}
