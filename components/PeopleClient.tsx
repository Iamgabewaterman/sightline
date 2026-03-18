"use client";

import { useState } from "react";
import {
  createContact,
  updateContact,
  deleteContact,
  createCrew,
  updateCrewName,
  deleteCrew,
  addCrewMember,
  removeCrewMember,
} from "@/app/actions/people";
import { Contact, CrewWithMembers } from "@/types";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import AvatarUpload from "./AvatarUpload";
import { updateContactAvatar } from "@/app/actions/avatar";

const TRADES = [
  "General",
  "Drywall",
  "Framing",
  "Plumbing",
  "Paint",
  "Trim",
  "Roofing",
  "Tile",
  "Flooring",
  "Electrical",
  "HVAC",
  "Concrete",
  "Landscaping",
];

const inputClass =
  "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full";

const selectClass =
  "bg-[#242424] border border-[#333333] text-white rounded-xl px-4 py-4 text-base focus:outline-none focus:border-orange-500 w-full appearance-none";

interface Props {
  initialContacts: Contact[];
  initialCrews: CrewWithMembers[];
}

export default function PeopleClient({ initialContacts, initialCrews }: Props) {
  const [section, setSection] = useState<"contacts" | "crews">("contacts");
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [crews, setCrews] = useState<CrewWithMembers[]>(initialCrews);

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState("");

  // Crew form state
  const [showCrewForm, setShowCrewForm] = useState(false);
  const [newCrewName, setNewCrewName] = useState("");
  const [editingCrewId, setEditingCrewId] = useState<string | null>(null);
  const [editingCrewName, setEditingCrewName] = useState("");
  const [crewSaving, setCrewSaving] = useState(false);
  const [crewError, setCrewError] = useState("");

  // Crew member management overlay
  const [managingCrewId, setManagingCrewId] = useState<string | null>(null);

  const contactById = new Map(contacts.map((c) => [c.id, c]));

  // ── CONTACTS ──────────────────────────────────────────

  async function handleContactSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setContactSaving(true);
    setContactError("");
    const fd = new FormData(e.currentTarget);

    if (editingContact) {
      const result = await updateContact(editingContact.id, fd);
      if (result.error) {
        setContactError(result.error);
      } else if (result.contact) {
        setContacts((prev) =>
          prev.map((c) => (c.id === editingContact.id ? result.contact! : c))
        );
        setEditingContact(null);
        setShowContactForm(false);
      }
    } else {
      const result = await createContact(fd);
      if (result.error) {
        setContactError(result.error);
      } else if (result.contact) {
        setContacts((prev) =>
          [...prev, result.contact!].sort((a, b) => a.name.localeCompare(b.name))
        );
        setShowContactForm(false);
      }
    }
    setContactSaving(false);
  }

  async function handleDeleteContact(id: string) {
    if (!confirm("Delete this contact? They will be removed from any crews.")) return;
    await deleteContact(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    // Remove from crews
    setCrews((prev) =>
      prev.map((cr) => ({
        ...cr,
        crew_members: cr.crew_members.filter((m) => m.contact_id !== id),
      }))
    );
  }

  function openEditContact(contact: Contact) {
    setEditingContact(contact);
    setShowContactForm(true);
    setContactError("");
  }

  function cancelContactForm() {
    setShowContactForm(false);
    setEditingContact(null);
    setContactError("");
  }

  // ── CREWS ─────────────────────────────────────────────

  async function handleCreateCrew(e: React.FormEvent) {
    e.preventDefault();
    if (!newCrewName.trim()) return;
    setCrewSaving(true);
    setCrewError("");
    const result = await createCrew(newCrewName.trim());
    if (result.error) {
      setCrewError(result.error);
    } else if (result.crew) {
      setCrews((prev) =>
        [...prev, { ...result.crew!, crew_members: [] }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setNewCrewName("");
      setShowCrewForm(false);
    }
    setCrewSaving(false);
  }

  async function handleSaveCrewName(id: string) {
    if (!editingCrewName.trim()) return;
    setCrewSaving(true);
    const result = await updateCrewName(id, editingCrewName.trim());
    if (!result.error) {
      setCrews((prev) =>
        prev.map((cr) =>
          cr.id === id ? { ...cr, name: editingCrewName.trim() } : cr
        )
      );
      setEditingCrewId(null);
    }
    setCrewSaving(false);
  }

  async function handleDeleteCrew(id: string) {
    if (!confirm("Delete this crew?")) return;
    await deleteCrew(id);
    setCrews((prev) => prev.filter((cr) => cr.id !== id));
    if (managingCrewId === id) setManagingCrewId(null);
  }

  async function handleAddMember(crewId: string, contactId: string) {
    const result = await addCrewMember(crewId, contactId);
    if (!result.error) {
      setCrews((prev) =>
        prev.map((cr) =>
          cr.id === crewId
            ? { ...cr, crew_members: [...cr.crew_members, { contact_id: contactId }] }
            : cr
        )
      );
    }
  }

  async function handleRemoveMember(crewId: string, contactId: string) {
    const result = await removeCrewMember(crewId, contactId);
    if (!result.error) {
      setCrews((prev) =>
        prev.map((cr) =>
          cr.id === crewId
            ? {
                ...cr,
                crew_members: cr.crew_members.filter((m) => m.contact_id !== contactId),
              }
            : cr
        )
      );
    }
  }

  const managingCrew = crews.find((cr) => cr.id === managingCrewId) ?? null;

  return (
    <>
      {/* Section tabs */}
      <div className="flex gap-2 mb-6">
        {(["contacts", "crews"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors ${
              section === s
                ? "bg-orange-500 text-white"
                : "bg-[#1A1A1A] border border-[#2a2a2a] text-gray-400"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── CONTACTS SECTION ── */}
      {section === "contacts" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </p>
            {!showContactForm && (
              <button
                onClick={() => {
                  setEditingContact(null);
                  setContactError("");
                  setShowContactForm(true);
                }}
                className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
              >
                + Add Contact
              </button>
            )}
          </div>

          {showContactForm && (
            <form
              onSubmit={handleContactSubmit}
              className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3"
            >
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                {editingContact ? "Edit Contact" : "New Contact"}
              </p>
              {/* Avatar upload — only shown when editing an existing contact */}
              {editingContact && (
                <div className="flex items-center gap-3">
                  <AvatarUpload
                    name={editingContact.name}
                    currentAvatarPath={editingContact.avatar_path}
                    storagePath={`contacts/${editingContact.id}`}
                    onSaved={async (path) => {
                      await updateContactAvatar(editingContact.id, path);
                      setContacts((prev) =>
                        prev.map((c) => c.id === editingContact.id ? { ...c, avatar_path: path } : c)
                      );
                    }}
                    size={60}
                  />
                  <p className="text-gray-500 text-xs">Tap to change photo</p>
                </div>
              )}
              <input
                name="name"
                type="text"
                required
                placeholder="Name"
                defaultValue={editingContact?.name ?? ""}
                className={inputClass}
              />
              <input
                name="phone"
                type="tel"
                placeholder="Phone (optional)"
                defaultValue={editingContact?.phone ?? ""}
                className={inputClass}
              />
              <select
                name="trade"
                defaultValue={editingContact?.trade ?? ""}
                className={selectClass}
              >
                <option value="">Trade specialty (optional)</option>
                {TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-base font-semibold shrink-0">$/hr</span>
                <input
                  name="hourly_rate"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder="Hourly rate (optional)"
                  defaultValue={editingContact?.hourly_rate ?? ""}
                  className={inputClass}
                />
              </div>
              <textarea
                name="notes"
                placeholder="Notes (optional)"
                defaultValue={editingContact?.notes ?? ""}
                rows={2}
                className={inputClass + " resize-none"}
              />
              {contactError && (
                <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                  {contactError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={contactSaving}
                  className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                >
                  {contactSaving ? "Saving..." : editingContact ? "Save Changes" : "Add Contact"}
                </button>
                <button
                  type="button"
                  onClick={cancelContactForm}
                  className="px-5 py-4 bg-[#242424] text-gray-400 font-semibold rounded-xl active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {contacts.length === 0 ? (
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
              <p className="text-gray-500 text-sm">No contacts yet</p>
              <p className="text-gray-600 text-xs mt-1">
                Add workers and subs to reuse them on labor logs
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {contacts.map((c) => {
                const supabase = createClient();
                const avatarUrl = c.avatar_path
                  ? supabase.storage.from("avatars").getPublicUrl(c.avatar_path).data.publicUrl
                  : null;
                return (
                  <div
                    key={c.id}
                    className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Avatar name={c.name} avatarUrl={avatarUrl} size={44} className="mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-base">{c.name}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {c.trade && (
                              <span className="text-orange-500 text-xs font-semibold bg-orange-500/10 px-2 py-0.5 rounded-full">
                                {c.trade}
                              </span>
                            )}
                            {c.hourly_rate !== null && (
                              <span className="text-gray-400 text-xs">
                                ${Number(c.hourly_rate).toLocaleString()}/hr
                              </span>
                            )}
                            {c.phone && (
                              <span className="text-gray-500 text-xs">{c.phone}</span>
                            )}
                          </div>
                          {c.notes && (
                            <p className="text-gray-600 text-xs mt-1 line-clamp-1">{c.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-3 shrink-0">
                        <button
                          onClick={() => openEditContact(c)}
                          className="text-gray-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
                          className="text-red-400 text-sm px-3 py-3 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CREWS SECTION ── */}
      {section === "crews" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
              {crews.length} crew{crews.length !== 1 ? "s" : ""}
            </p>
            {!showCrewForm && (
              <button
                onClick={() => {
                  setNewCrewName("");
                  setCrewError("");
                  setShowCrewForm(true);
                }}
                className="text-white font-semibold text-sm bg-[#1A1A1A] border border-[#2a2a2a] px-4 py-3 rounded-xl active:scale-95 transition-transform"
              >
                + Create Crew
              </button>
            )}
          </div>

          {showCrewForm && (
            <form
              onSubmit={handleCreateCrew}
              className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4 mb-4 flex flex-col gap-3"
            >
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                New Crew
              </p>
              <input
                type="text"
                value={newCrewName}
                onChange={(e) => setNewCrewName(e.target.value)}
                placeholder="Crew name (e.g. Rodriguez Roofing)"
                required
                className={inputClass}
              />
              {crewError && (
                <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                  {crewError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={crewSaving}
                  className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                >
                  {crewSaving ? "Saving..." : "Create Crew"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCrewForm(false); setCrewError(""); }}
                  className="px-5 py-4 bg-[#242424] text-gray-400 font-semibold rounded-xl active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {crews.length === 0 ? (
            <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl py-10 text-center">
              <p className="text-gray-500 text-sm">No crews yet</p>
              <p className="text-gray-600 text-xs mt-1">
                Group contacts into named crews to log their labor as a unit
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {crews.map((cr) => {
                const members = cr.crew_members
                  .map((m) => contactById.get(m.contact_id))
                  .filter(Boolean) as Contact[];
                const combinedRate = members.reduce(
                  (s, m) => s + (m.hourly_rate ? Number(m.hourly_rate) : 0),
                  0
                );
                const isEditingName = editingCrewId === cr.id;

                return (
                  <div
                    key={cr.id}
                    className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-4"
                  >
                    {isEditingName ? (
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          value={editingCrewName}
                          onChange={(e) => setEditingCrewName(e.target.value)}
                          className={inputClass + " flex-1"}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveCrewName(cr.id)}
                          disabled={crewSaving}
                          className="bg-orange-500 text-white font-bold px-4 py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingCrewId(null)}
                          className="px-4 py-3 bg-[#242424] text-gray-400 rounded-xl active:scale-95 transition-transform"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-semibold text-base">{cr.name}</p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-gray-400 text-xs">
                              {members.length} member{members.length !== 1 ? "s" : ""}
                            </span>
                            {combinedRate > 0 && (
                              <span className="text-orange-500 text-xs font-semibold">
                                ${combinedRate.toLocaleString()}/hr combined
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setEditingCrewId(cr.id);
                              setEditingCrewName(cr.name);
                            }}
                            className="text-gray-400 text-xs px-3 py-2 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform min-h-[44px]"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => handleDeleteCrew(cr.id)}
                            className="text-red-400 text-xs px-3 py-2 rounded-xl border border-[#2a2a2a] active:scale-95 transition-transform min-h-[44px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Member chips */}
                    {members.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {members.map((m) => (
                          <span
                            key={m.id}
                            className="text-gray-300 text-xs bg-[#242424] px-3 py-1.5 rounded-full"
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setManagingCrewId(cr.id)}
                      className="w-full text-gray-400 font-semibold text-sm border border-[#2a2a2a] py-3 rounded-xl active:scale-95 transition-transform"
                    >
                      Manage Members
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MANAGE CREW MEMBERS OVERLAY ── */}
      {managingCrew && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0 border-b border-[#2a2a2a]">
            <div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                Manage Members
              </p>
              <h2 className="text-white font-black text-xl">{managingCrew.name}</h2>
            </div>
            <button
              onClick={() => setManagingCrewId(null)}
              className="text-gray-400 text-3xl leading-none w-11 h-11 flex items-center justify-center active:scale-95"
            >
              ×
            </button>
          </div>

          <div className="flex-1 px-5 py-5">
            {/* Current members */}
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Current Members
            </p>
            {managingCrew.crew_members.length === 0 ? (
              <p className="text-gray-600 text-sm mb-6">No members yet. Add from contacts below.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-6">
                {managingCrew.crew_members.map((m) => {
                  const contact = contactById.get(m.contact_id);
                  if (!contact) return null;
                  return (
                    <div
                      key={m.contact_id}
                      className="flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3"
                    >
                      <div>
                        <p className="text-white font-semibold text-base">{contact.name}</p>
                        <div className="flex gap-2 mt-0.5">
                          {contact.trade && (
                            <span className="text-orange-500 text-xs">{contact.trade}</span>
                          )}
                          {contact.hourly_rate !== null && (
                            <span className="text-gray-500 text-xs">
                              ${Number(contact.hourly_rate)}/hr
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(managingCrew.id, contact.id)}
                        className="text-red-400 font-semibold text-sm px-4 py-3 border border-[#2a2a2a] rounded-xl active:scale-95 transition-transform"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add from contacts */}
            {(() => {
              const memberIds = new Set(managingCrew.crew_members.map((m) => m.contact_id));
              const available = contacts.filter((c) => !memberIds.has(c.id));
              if (available.length === 0) return null;
              return (
                <>
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
                    Add from Contacts
                  </p>
                  <div className="flex flex-col gap-2">
                    {available.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-4 py-3"
                      >
                        <div>
                          <p className="text-white font-semibold text-base">{c.name}</p>
                          <div className="flex gap-2 mt-0.5">
                            {c.trade && (
                              <span className="text-gray-500 text-xs">{c.trade}</span>
                            )}
                            {c.hourly_rate !== null && (
                              <span className="text-gray-500 text-xs">
                                ${Number(c.hourly_rate)}/hr
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddMember(managingCrew.id, c.id)}
                          className="text-orange-500 font-semibold text-sm px-4 py-3 border border-orange-500/30 rounded-xl active:scale-95 transition-transform"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}
