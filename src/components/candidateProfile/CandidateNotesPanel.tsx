import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Pencil, Trash2, Check, X } from 'lucide-react';
import { useState } from 'react';
import type { CandidateNote } from './candidateProfileCache';

interface CandidateNotesPanelProps {
  notes: CandidateNote[];
  loadingNotes: boolean;
  newNote: string;
  onNewNoteChange: (val: string) => void;
  onSaveNote: () => void;
  savingNote: boolean;
  currentUserId?: string;
  onStartEditing: (note: CandidateNote) => void;
  onConfirmDelete: (noteId: string) => void;
  editingNoteId: string | null;
  editingNoteText: string;
  originalNoteText: string;
  onEditingNoteTextChange: (val: string) => void;
  onUpdateNote: () => void;
  onCancelEditing: () => void;
}

export const CandidateNotesPanel = ({
  notes,
  loadingNotes,
  newNote,
  onNewNoteChange,
  onSaveNote,
  savingNote,
  currentUserId,
  onStartEditing,
  onConfirmDelete,
  editingNoteId,
  editingNoteText,
  originalNoteText,
  onEditingNoteTextChange,
  onUpdateNote,
  onCancelEditing,
}: CandidateNotesPanelProps) => {
  const hasChanged = editingNoteText.trim() !== originalNoteText.trim();
  return (
    <div className="space-y-3">
      {/* Add new note */}
      <div className="space-y-3">
        <Textarea
          value={newNote}
          onChange={(e) => onNewNoteChange(e.target.value)}
          placeholder="Skriv en anteckning..."
          className="w-full min-h-[60px] bg-white/5 border-white/20 text-white placeholder:text-white/40 resize-none text-xs"
        />
        <div className="flex justify-center">
          <Button
            onClick={onSaveNote}
            disabled={!newNote.trim() || savingNote}
            size="sm"
            className="w-auto rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs px-4"
          >
            <Send className="h-3 w-3 mr-1.5" />
            Lägg till
          </Button>
        </div>
      </div>

      {loadingNotes ? (
        <div className="space-y-2 py-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="p-2 rounded bg-white/5">
              <Skeleton className="h-3 w-full bg-white/10 mb-1" />
              <Skeleton className="h-3 w-2/3 bg-white/10" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="text-sm text-white text-center py-4">Inga anteckningar ännu</p>
      ) : (
        <div className="space-y-3">
          {(() => {
            const groupedNotes = notes.reduce((groups, note) => {
              const displayDate = note.updated_at || note.created_at;
              const date = new Date(displayDate).toLocaleDateString('sv-SE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              if (!groups[date]) groups[date] = [];
              groups[date].push(note);
              return groups;
            }, {} as Record<string, CandidateNote[]>);

            return Object.entries(groupedNotes).map(([date, dateNotes]) => (
              <div key={date}>
                <p className="text-xs text-white mb-2 capitalize">{date}</p>
                <div className="space-y-2">
                  {dateNotes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-white/5 rounded-lg p-2.5 group relative"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium text-white">
                          {note.author_name || 'Okänd'} skrev:
                        </span>
                      </div>

                      {editingNoteId === note.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingNoteText}
                            onChange={(e) => onEditingNoteTextChange(e.target.value)}
                            className="min-h-[60px] text-xs bg-white/10 border-white/20 text-white resize-none"
                            placeholder="Skriv din anteckning..."
                          />
                          <div className="flex justify-center gap-1.5 pt-1">
                            <Button
                              size="sm"
                              onClick={onUpdateNote}
                              disabled={savingNote || !editingNoteText.trim() || !hasChanged}
                              className="h-7 text-[10px] px-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/20"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Spara
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={onCancelEditing}
                              className="h-7 text-[10px] px-3 rounded-full text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Avbryt
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-white whitespace-pre-wrap pr-10 leading-relaxed break-all">{note.note}</p>
                          <p className="text-xs text-white mt-1">
                            {new Date(note.updated_at || note.created_at).toLocaleTimeString('sv-SE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {note.employer_id === currentUserId && (
                            <div className="absolute top-2 right-2 flex items-center gap-0.5">
                              <button
                                onClick={() => onStartEditing(note)}
                                className="p-1.5 text-white hover:text-white hover:bg-white/10 rounded-full transition-all duration-300"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => onConfirmDelete(note.id)}
                                className="rounded-full border border-destructive/40 bg-destructive/20 p-1.5 text-white transition-all duration-300 md:hover:border-destructive/50 md:hover:bg-destructive/30 md:hover:text-white"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
};
