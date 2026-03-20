import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface RichTextEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  editable?: boolean;
}

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    [{ align: [] }],
    ['link'],
    ['clean'],
  ],
};

const formats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'blockquote', 'code-block',
  'align', 'link',
];

export default function RichTextEditor({ content, onUpdate, editable = true }: RichTextEditorProps) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <ReactQuill
        theme="snow"
        value={content}
        onChange={onUpdate}
        readOnly={!editable}
        modules={editable ? modules : { toolbar: false }}
        formats={formats}
        placeholder="Start writing your note..."
      />
    </div>
  );
}
