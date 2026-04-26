"use client";

import { useState } from "react";
import EditEventForm, { type EditableEvent } from "./edit-event-form";

/**
 * Client wrapper for one event row in /admin/artists/[slug]. Owns the
 * outer card div, the read-only display (passed in as `children`), and the
 * "✏️ Edit" toggle that expands an EditEventForm inline below.
 *
 * The server-rendered page.tsx still does all the heavy lifting (RSVP
 * lookups, reminder chip rendering, send-reminder/delete forms) and just
 * hands those nodes in as `children`. We only need the client boundary
 * for the edit-toggle state.
 */
export default function EditableEventRow({
  event,
  artistSlug,
  children,
}: {
  event: EditableEvent;
  artistSlug: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-2xl bg-black/40 p-3">
      {children}

      {/* Edit affordance — sits at the bottom of the read-only row, parallel
          to the existing "View RSVPs" details summary. Hidden while the form
          is open since the form itself has its own Cancel button. */}
      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 inline-flex text-[11px] text-white/60 hover:text-white"
        >
          ✏️ Edit
        </button>
      )}

      {editing && (
        <EditEventForm
          event={event}
          artistSlug={artistSlug}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
