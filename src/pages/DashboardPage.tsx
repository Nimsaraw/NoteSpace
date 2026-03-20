import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, LogOut, FileText, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Note {
  id: string;
  title: string;
  content: string | null;
  updated_at: string;
  user_id: string;
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[]>([]);
  const [sharedNotes, setSharedNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'my' | 'shared'>('my');

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase.from('notes').select('id, title, content, updated_at, user_id').eq('user_id', user.id).order('updated_at', { ascending: false });

    if (search.trim()) {
      query = query.textSearch('search_vector', search.trim(), { type: 'websearch' });
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load notes');
    } else {
      setNotes(data || []);
    }

    // Fetch shared notes
    const { data: collabs } = await supabase
      .from('note_collaborators')
      .select('note_id')
      .eq('collaborator_user_id', user.id);

    if (collabs && collabs.length > 0) {
      const noteIds = collabs.map(c => c.note_id);
      let sharedQuery = supabase.from('notes').select('id, title, content, updated_at, user_id').in('id', noteIds).order('updated_at', { ascending: false });

      if (search.trim()) {
        sharedQuery = sharedQuery.textSearch('search_vector', search.trim(), { type: 'websearch' });
      }

      const { data: sharedData } = await sharedQuery;
      setSharedNotes(sharedData || []);
    } else {
      setSharedNotes([]);
    }

    setLoading(false);
  }, [user, search]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const createNote = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('notes').insert({ user_id: user.id, title: 'Untitled' }).select('id').single();
    if (error) {
      toast.error('Failed to create note');
    } else {
      navigate(`/note/${data.id}`);
    }
  };

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete note');
    } else {
      toast.success('Note deleted');
      fetchNotes();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const stripHtml = (html: string | null) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const displayNotes = tab === 'my' ? notes : sharedNotes;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="font-display text-xl font-semibold">NoteSpace</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={createNote} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Note
            </Button>
            <Button onClick={handleSignOut} variant="ghost" size="sm">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setTab('my')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'my' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            My Notes ({notes.length})
          </button>
          <button
            onClick={() => setTab('shared')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'shared' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Shared ({sharedNotes.length})
            </span>
          </button>
        </div>

        {/* Notes grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : displayNotes.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="font-display text-lg text-muted-foreground">
              {tab === 'my' ? 'No notes yet' : 'No shared notes'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {tab === 'my' ? 'Create your first note to get started' : 'Notes shared with you will appear here'}
            </p>
            {tab === 'my' && (
              <Button onClick={createNote} className="mt-4 gap-1.5" size="sm">
                <Plus className="h-4 w-4" /> Create Note
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayNotes.map(note => (
              <div
                key={note.id}
                onClick={() => navigate(`/note/${note.id}`)}
                className="group cursor-pointer rounded-xl border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-display font-semibold text-card-foreground line-clamp-1">
                    {note.title || 'Untitled'}
                  </h3>
                  {tab === 'my' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => deleteNote(note.id, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-3">
                  {stripHtml(note.content) || 'Empty note'}
                </p>
                <p className="mt-3 text-xs text-muted-foreground/60">
                  {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
