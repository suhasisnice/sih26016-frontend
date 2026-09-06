import { useState } from 'react';
import * as documentsApi from '../../api/documents';
import { useMutation } from '../../hooks/useApi';
import { docTypeLabel } from '../../lib/labels';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Textarea } from '../ui/Field';

const OPTIONS = [
  { status: 'verified', label: 'Verify', variant: 'primary', needsNote: false },
  { status: 'correction_requested', label: 'Send for correction', variant: 'quiet', needsNote: true },
  { status: 'rejected', label: 'Reject', variant: 'danger', needsNote: true },
];

/* Document Review — VERIFY / REJECT / SEND FOR CORRECTION, with a required
   remark for anything but a plain verify. Deliberately not a fourth
   "request additional document" action here: that is a stage missing a
   document type entirely (see MissingDocumentsPanel), not a review outcome
   on a document that was actually filed. */
export default function VerifyDocumentModal({ document: doc, onClose, onDone }) {
  const [choice, setChoice] = useState(null);
  const [note, setNote] = useState('');
  const verify = useMutation((status, text) => documentsApi.verify(doc.id, status, text));

  async function onSubmit() {
    try {
      await verify.run(choice.status, note.trim() || null);
      onDone();
    } catch {
      /* verify.error already carries the message to show */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={verify.pending}
      error={verify.error}
      title="Review document"
      subtitle={`${docTypeLabel(doc.doc_type)} · v${doc.version} · ${doc.filename}`}
      footer={
        choice ? (
          <>
            <Button variant="quiet" onClick={() => setChoice(null)} disabled={verify.pending}>
              Back
            </Button>
            <Button
              variant={choice.variant}
              onClick={onSubmit}
              disabled={verify.pending || (choice.needsNote && note.trim().length < 3)}
            >
              {verify.pending ? 'Saving…' : `Confirm: ${choice.label.toLowerCase()}`}
            </Button>
          </>
        ) : (
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
        )
      }
    >
      {choice ? (
        <Textarea
          label={choice.needsNote ? 'Reason (required)' : 'Note (optional)'}
          value={note}
          maxLength={500}
          placeholder="What is wrong, or what still needs to change."
          onChange={(event) => setNote(event.target.value)}
        />
      ) : (
        <div style={{ display: 'grid', gap: 'var(--s3)' }}>
          {OPTIONS.map((option) => (
            <Button key={option.status} variant={option.variant} block onClick={() => setChoice(option)}>
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </Modal>
  );
}
