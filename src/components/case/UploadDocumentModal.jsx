import { useState } from 'react';
import * as documentsApi from '../../api/documents';
import { useMutation } from '../../hooks/useApi';
import { useEnums } from '../../hooks/useEnums';
import { docTypeLabel } from '../../lib/labels';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Select } from '../ui/Field';

/* Filing a document supersedes any earlier copy of the same type on this
   case rather than adding a second, equally authoritative row — the backend
   keeps every version, and DocumentHistory on CaseDetail is where the old
   ones stay reachable. */
export default function UploadDocumentModal({ caseId, onClose, onDone }) {
  const { doc_types: docTypes } = useEnums();
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  const save = useMutation(() => documentsApi.upload({ caseId, docType, file }));

  async function onSave() {
    if (!docType) {
      setError('Choose which document this is.');
      return;
    }
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    setError(null);
    try {
      await save.run();
      onDone();
    } catch {
      /* useMutation holds it; the modal renders it. */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={save.pending}
      error={save.error}
      title="Upload a document"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} disabled={save.pending}>
            {save.pending ? 'Uploading…' : 'Upload'}
          </Button>
        </>
      }
    >
      <Select
        label="Document type"
        value={docType}
        error={error && !docType ? error : undefined}
        placeholder="Choose a document type"
        options={docTypes.map((value) => ({ value, label: docTypeLabel(value) }))}
        onChange={(event) => {
          setDocType(event.target.value);
          setError(null);
        }}
      />

      <label className="field">
        <span className="field__label">File</span>
        <input
          type="file"
          className="field__control"
          onChange={(event) => {
            setFile(event.target.files ? event.target.files[0] : null);
            setError(null);
          }}
        />
        {error && file === null && docType && (
          <span className="field__error" role="alert">{error}</span>
        )}
        {!error && (
          <span className="field__hint">
            Re-uploading the same document type supersedes the version already on file.
          </span>
        )}
      </label>
    </Modal>
  );
}
