import { useState } from 'react';
import * as casesApi from '../../api/cases';
import { useMutation } from '../../hooks/useApi';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Textarea } from '../ui/Field';

/* Reverses a hold — back to active at whatever stage it was already
   sitting at, which never changed while held. No step-up: resuming isn't
   the high-impact half of this pair, holding is. */
export default function ResumeCaseModal({ caseRecord, onClose, onDone }) {
  const [note, setNote] = useState('');
  const resume = useMutation((text) => casesApi.resume(caseRecord.id, text));

  async function onConfirm() {
    try {
      await resume.run(note.trim());
      onDone();
    } catch {
      /* resume.error already carries the message to show */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={resume.pending}
      error={resume.error}
      title="Resume case"
      subtitle={`${caseRecord.case_number} will become active again.`}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={resume.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={resume.pending || note.trim().length < 3}>
            {resume.pending ? 'Resuming…' : 'Resume case'}
          </Button>
        </>
      }
    >
      <Textarea
        label="What was resolved"
        value={note}
        maxLength={300}
        placeholder="What changed since the case was held."
        onChange={(event) => setNote(event.target.value)}
      />
    </Modal>
  );
}
