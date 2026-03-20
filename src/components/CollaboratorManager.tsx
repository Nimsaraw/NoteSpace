import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, UserPlus, Trash2, Eye, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface Collaborator {
  id: string;
  collaborator_user_id: string;
  can_edit: boolean;
  profile?: { display_name: string | null; avatar_url: string | null };
}

interface CollaboratorManagerProps {
  noteId: string;
  noteOwnerId: string;
}

export default function CollaboratorManager({ noteId, noteOwnerId }: CollaboratorManagerProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const isOwner = user?.id === noteOwnerId;

  const fetchCollaborators = async () => {
    const { data, error } = await supabase
      .from('note_collaborators')
      .select('id, collaborator_user_id, can_edit')
      .eq('note_id', noteId);

    if (error) return;

    // Fetch profiles for each collaborator
    if (data && data.length > 0) {
      const userIds = data.map(c => c.collaborator_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const enriched = data.map(c => ({
        ...c,
        profile: profiles?.find(p => p.user_id === c.collaborator_user_id) || undefined,
      }));
      setCollaborators(enriched);
    } else {
      setCollaborators([]);
    }
  };

  useEffect(() => {
    if (open) fetchCollaborators();
  }, [open, noteId]);

  const addCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    // Find user by email - look up in profiles by checking auth
    // We need to find the user_id from the email
    // Since we can't query auth.users directly, we'll use a workaround
    // by checking profiles display_name (which defaults to email on signup)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('display_name', email.trim());

    if (!profiles || profiles.length === 0) {
      toast.error('User not found. They must sign up first.');
      setLoading(false);
      return;
    }

    const targetUserId = profiles[0].user_id;

    if (targetUserId === user?.id) {
      toast.error("You can't add yourself as a collaborator");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('note_collaborators').insert({
      note_id: noteId,
      collaborator_user_id: targetUserId,
      can_edit: canEdit,
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('This user is already a collaborator');
      } else {
        toast.error('Failed to add collaborator');
      }
    } else {
      toast.success('Collaborator added!');
      setEmail('');
      setCanEdit(false);
      fetchCollaborators();
    }
    setLoading(false);
  };

  const removeCollaborator = async (id: string) => {
    const { error } = await supabase.from('note_collaborators').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove collaborator');
    } else {
      toast.success('Collaborator removed');
      fetchCollaborators();
    }
  };

  const toggleEditPermission = async (id: string, currentCanEdit: boolean) => {
    const { error } = await supabase.from('note_collaborators').update({ can_edit: !currentCanEdit }).eq('id', id);
    if (error) {
      toast.error('Failed to update permissions');
    } else {
      fetchCollaborators();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
          {collaborators.length > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {collaborators.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Share Note</DialogTitle>
        </DialogHeader>

        {isOwner && (
          <form onSubmit={addCollaborator} className="space-y-4">
            <div className="space-y-2">
              <Label>Add by email (their display name/email)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="user@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={loading} className="gap-1">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={canEdit} onCheckedChange={setCanEdit} id="can-edit" />
              <Label htmlFor="can-edit" className="text-sm">Can edit</Label>
            </div>
          </form>
        )}

        <div className="mt-2 space-y-2">
          {collaborators.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No collaborators yet
            </p>
          ) : (
            collaborators.map(collab => (
              <div key={collab.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
                    {(collab.profile?.display_name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{collab.profile?.display_name || 'Unknown'}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {collab.can_edit ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {collab.can_edit ? 'Can edit' : 'View only'}
                    </p>
                  </div>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => toggleEditPermission(collab.id, collab.can_edit)}
                    >
                      {collab.can_edit ? 'Make viewer' : 'Make editor'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeCollaborator(collab.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
