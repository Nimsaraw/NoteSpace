import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { toast } from 'sonner';
import RichTextEditor from '@/components/RichTextEditor';
import CollaboratorManager from '@/components/CollaboratorManager';

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteOwnerId, setNoteOwnerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const fetchNote = async () => {
      if (!id || !user) return;

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast.error('Note not found');
        navigate('/');
        return;
      }

      setTitle(data.title);
      setContent(data.content || '');
      setNoteOwnerId(data.user_id);

      // Check edit permissions
      if (data.user_id === user.id) {
        setCanEdit(true);
      } else {
        const { data: collab } = await supabase
          .from('note_collaborators')
          .select('can_edit')
          .eq('note_id', id)
          .eq('collaborator_user_id', user.id)
          .single();

        setCanEdit(collab?.can_edit || false);
      }

      setLoading(false);
    };

    fetchNote();
  }, [id, user, navigate]);

  const saveNote = useCallback(async (newTitle: string, newContent: string) => {
    if (!id || !canEdit) return;
    setSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from('notes')
      .update({ title: newTitle || 'Untitled', content: newContent })
      .eq('id', id);

    if (error) {
      toast.error('Failed to save');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }, [id, canEdit]);

  const debouncedSave = useCallback((newTitle: string, newContent: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveNote(newTitle, newContent), 1000);
  }, [saveNote]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    debouncedSave(newTitle, content);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    debouncedSave(title, newContent);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-accent">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
            {saving && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => saveNote(title, content)} className="gap-1.5">
                <Save className="h-4 w-4" /> Save
              </Button>
            )}
            {id && <CollaboratorManager noteId={id} noteOwnerId={noteOwnerId} />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Title */}
        {canEdit ? (
          <Input
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Note title..."
            className="mb-4 border-0 bg-transparent font-display text-3xl font-bold shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
          />
        ) : (
          <h1 className="mb-4 font-display text-3xl font-bold">{title}</h1>
        )}

        {/* Editor */}
        <RichTextEditor content={content} onUpdate={handleContentChange} editable={canEdit} />
      </main>
    </div>
  );
}
