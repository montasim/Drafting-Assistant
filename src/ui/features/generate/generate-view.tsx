import { useState } from 'react';
import { feedbackAfterEdit, feedbackAfterRating } from '../../../application/feedback';
import { addRevision, rewriteContent } from '../../../application/workflows';
import type { Feedback, RewriteGoal, RewriteHistoryRecord } from '../../../domain/schemas';
import { storageRepository } from '../../../infrastructure/storage/chrome-storage';
import { useForegroundJob } from '../../hooks/use-foreground-job';
import { useAppStore } from '../../state/app-store';
import {
  AccordionContent,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
} from '../../primitives/accordion';
import { Button } from '../../primitives/button';
import { Card } from '../../primitives/card';
import { Input } from '../../primitives/input';
import { FieldGroup, Label } from '../../primitives/label';
import { SelectContent, SelectItem, SelectRoot, SelectTrigger } from '../../primitives/select';
import { Textarea } from '../../primitives/textarea';
import { copyText, EditorActions, PageHeading, StatusBadge } from '../../components/common';

export function GenerateView() {
  const { app, session, refresh } = useAppStore();
  const job = useForegroundJob();
  const [editingSource, setEditingSource] = useState(false);
  const [ephemeral, setEphemeral] = useState<RewriteHistoryRecord | null>(null);

  const selected = session?.activeRecordId
    ? app?.history.find((item) => item.id === session.activeRecordId && item.type === 'rewrite')
    : undefined;
  const record = ephemeral ?? (selected?.type === 'rewrite' ? selected : null);

  if (!app || !session) return null;
  const compose = session.generateCompose;

  const updateCompose = async (patch: Partial<typeof compose>) => {
    await storageRepository.updateSession((current) => ({
      ...current,
      generateCompose: { ...current.generateCompose, ...patch },
    }));
    await refresh();
  };

  const persistRecord = async (next: RewriteHistoryRecord) => {
    if (chrome.extension.inIncognitoContext) setEphemeral(next);
    else await storageRepository.addHistory(next);
    await storageRepository.updateSession((current) => ({
      ...current,
      activeRecordId: next.id,
      activeTab: 'generate',
      generateCompose: { original: '', goal: 'clearer', customGoal: '' },
    }));
    setEditingSource(false);
    await refresh();
  };

  const generate = () => {
    void job.run(async (signal) => {
      const completed = await rewriteContent(
        compose.original,
        compose.goal,
        compose.customGoal,
        structuredClone(app.profile),
        structuredClone(app.learnedPreferences),
        signal,
      );
      await persistRecord(completed.record);
      return completed.record;
    });
  };

  const regenerate = () => {
    if (!record) return;
    void job.run(async (signal) => {
      const completed = await rewriteContent(
        record.original,
        record.goal,
        record.customGoal,
        structuredClone(app.profile),
        structuredClone(app.learnedPreferences),
        signal,
      );
      const next = addRevision(record, completed.record.currentText, completed.record.provider);
      if (next.type === 'rewrite') await persistRecord(next);
      return next;
    });
  };

  if (!record || editingSource) {
    return (
      <>
        <PageHeading
          title="Generate a rewrite"
          description="Paste text and reshape it in your saved voice."
          compact
          action={
            record ? (
              <Button size="compact" onClick={() => setEditingSource(false)}>
                Back to rewrite
              </Button>
            ) : undefined
          }
        />
        <Card className="p-4">
          <FieldGroup>
            <Label htmlFor="rewrite-source">Content to rewrite</Label>
            <Textarea
              id="rewrite-source"
              value={compose.original}
              onChange={(event) => void updateCompose({ original: event.target.value })}
              placeholder="Paste a paragraph, draft, note or post here."
              className="min-h-[180px]"
              maxLength={12_000}
            />
          </FieldGroup>
          <FieldGroup className="mt-3">
            <Label htmlFor="rewrite-goal">Rewrite goal</Label>
            <SelectRoot
              value={compose.goal}
              onValueChange={(value) => void updateCompose({ goal: value as RewriteGoal })}
            >
              <SelectTrigger id="rewrite-goal">
                <span>{goalLabel(compose.goal)}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clearer">Polish and clarify</SelectItem>
                <SelectItem value="shorter">Make it more concise</SelectItem>
                <SelectItem value="more-professional">More professional</SelectItem>
                <SelectItem value="more-conversational">Make it conversational</SelectItem>
                <SelectItem value="custom">Custom goal</SelectItem>
              </SelectContent>
            </SelectRoot>
          </FieldGroup>
          {compose.goal === 'custom' ? (
            <FieldGroup className="mt-3">
              <Label htmlFor="custom-rewrite-goal">Custom goal</Label>
              <Input
                id="custom-rewrite-goal"
                value={compose.customGoal}
                onChange={(event) => void updateCompose({ customGoal: event.target.value })}
              />
            </FieldGroup>
          ) : null}
          <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-muted before:font-bold before:text-proof before:content-['✓']">
            Uses your tone and writing profile from Settings.
          </p>
          {job.error ? (
            <p role="alert" className="mt-2 text-[11px] text-danger">
              {job.error}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end">
            <Button variant="primary" disabled={job.running} onClick={generate}>
              {job.running ? 'Generating…' : 'Generate rewrite'}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const updateRecord = async (next: RewriteHistoryRecord, feedback?: Feedback) => {
    if (chrome.extension.inIncognitoContext) setEphemeral(next);
    else await storageRepository.addHistory(next, feedback ? { feedback } : undefined);
    await refresh();
  };

  const rate = (rating: 'liked' | 'disliked') => {
    const feedback = feedbackAfterRating(
      record.feedback,
      record.generatedText,
      record.currentText,
      rating,
    );
    void updateRecord(
      {
        ...record,
        updatedAt: new Date().toISOString(),
        feedback,
      },
      feedback,
    );
  };

  return (
    <>
      <PageHeading
        title="Your rewrite"
        description="Edit the result until it sounds right."
        compact
        actionAlign="center"
        action={
          <Button
            size="compact"
            onClick={() => {
              void updateCompose({
                original: record.original,
                goal: record.goal,
                customGoal: record.customGoal,
              });
              setEditingSource(true);
            }}
          >
            Edit source
          </Button>
        }
      />
      {job.error ? (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger-bg p-3 text-[11px] text-danger">
          {job.error}
        </p>
      ) : null}
      <Card className="p-4">
        <StatusBadge>Rewritten in your voice</StatusBadge>
        <div className="flex min-h-[34px] items-center justify-between gap-2">
          <strong className="text-xs">Editable rewrite</strong>
          <EditorActions
            rating={record.feedback?.rating ?? null}
            onRate={rate}
            onRegenerate={regenerate}
            onCopy={() => copyText(record.currentText)}
            canRegenerate={!job.running}
          />
        </div>
        <Textarea
          value={record.currentText}
          aria-label="Editable rewrite"
          onChange={(event) => {
            const feedback = feedbackAfterEdit(
              record.feedback,
              record.generatedText,
              event.target.value,
            );
            void updateRecord(
              {
                ...record,
                currentText: event.target.value,
                updatedAt: new Date().toISOString(),
                ...(feedback ? { feedback } : {}),
              },
              feedback,
            );
          }}
          className="mt-3 min-h-[280px]"
        />
        <AccordionRoot className="mt-3" type="single" defaultValue="original" collapsible>
          <AccordionItem value="original">
            <AccordionTrigger>Original content</AccordionTrigger>
            <AccordionContent>
              <p className="whitespace-pre-wrap text-[11.5px] leading-[1.5] text-muted">
                {record.original}
              </p>
            </AccordionContent>
          </AccordionItem>
        </AccordionRoot>
      </Card>
    </>
  );
}

function goalLabel(goal: RewriteGoal): string {
  return {
    clearer: 'Polish and clarify',
    shorter: 'Make it more concise',
    'more-professional': 'More professional',
    'more-conversational': 'Make it conversational',
    custom: 'Custom goal',
  }[goal];
}
