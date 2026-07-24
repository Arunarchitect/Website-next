// app/drawing/components/DocumentForm.tsx

"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  getOrganisations,
  getProjects,
  getDeliverables,
  getFullFileUrl,
} from "../drawingApi";
import { DrawingDocumentFormData, DrawingDocumentResolved, Organisation, Project, Deliverable } from "../types";

interface DocumentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => Promise<void>;
  document?: DrawingDocumentResolved | null;
  title: string;
  submitLabel: string;
}

const FILE_TYPE_OPTIONS = [
  { value: 'pdf', label: 'PDF Document' },
  { value: 'image', label: 'Image File' },
  { value: 'dxf', label: 'DXF CAD File' },
  { value: 'ifc', label: 'IFC BIM File' },
  { value: 'document', label: 'Other Document' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
  { value: 'client', label: 'Client' },
  { value: 'architect', label: 'Architect' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'drawing_private_role', label: 'Drawing Private Role' },
];

export default function DocumentForm({
  isOpen,
  onClose,
  onSave,
  document,
  title,
  submitLabel,
}: DocumentFormProps) {
  // Form state
  const [formData, setFormData] = useState<Partial<DrawingDocumentFormData>>({
    deliverable_id: 0,
    title: '',
    description: '',
    file_type: 'pdf',
    category: '',
    version: '1.0',
    status: 'draft',
    tags: [],
    is_private: false,
    allowed_roles: [],
  });

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  // Dropdown state
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [selectedOrganisationId, setSelectedOrganisationId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<number | null>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingOrganisations, setLoadingOrganisations] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingDeliverables, setLoadingDeliverables] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Helper function
  const getSafeValue = <T,>(value: T | undefined | null, fallback: T | null = null): T | null => {
    return value !== undefined && value !== null ? value : fallback;
  };

  // Load organisations on mount
  useEffect(() => {
    if (isOpen) {
      loadOrganisations();
    }
  }, [isOpen]);

  // Load document data when editing
  useEffect(() => {
    if (document && isOpen) {
      console.log('📄 Editing document:', document);

      // Set form data from document
      setFormData({
        deliverable_id: getSafeValue(document.deliverable_id, 0) ?? 0,
        title: getSafeValue(document.title, '') ?? '',
        description: getSafeValue(document.description, '') ?? '',
        file_type: getSafeValue(document.file_type, 'pdf') ?? 'pdf',
        category: getSafeValue(document.category, '') ?? '',
        version: getSafeValue(document.version, '1.0') ?? '1.0',
        status: getSafeValue(document.status, 'draft') ?? 'draft',
        tags: getSafeValue(document.tags, []) ?? [],
        is_private: getSafeValue(document.is_private, false) ?? false,
        allowed_roles: getSafeValue(document.allowed_roles, []) ?? [],
      });

      // Set selected deliverable
      if (document.deliverable_id) {
        setSelectedDeliverableId(document.deliverable_id);
      }

      // Set file preview if exists
      if (document.file_url) {
        setFilePreview(getFullFileUrl(document.file_url));
      }
      if (document.thumbnail_url) {
        setThumbnailPreview(getFullFileUrl(document.thumbnail_url));
      }

      // Set the hierarchy for the document
      const loadHierarchy = async () => {
        if (document.organisation_id) {
          setSelectedOrganisationId(document.organisation_id);
          // Load projects for this organisation
          await loadProjects(document.organisation_id);

          if (document.project_id) {
            setSelectedProjectId(document.project_id);
            // Load deliverables for this project
            await loadDeliverables(document.project_id);
          }
        }
      };

      loadHierarchy();
    }
  }, [document, isOpen]);

  const loadOrganisations = async () => {
    setLoadingOrganisations(true);
    try {
      const data = await getOrganisations();
      setOrganisations(data);
    } catch (err) {
      console.error('Error loading organisations:', err);
      setError('Failed to load organisations');
    } finally {
      setLoadingOrganisations(false);
    }
  };

  const loadProjects = async (organisationId: number) => {
    setLoadingProjects(true);
    try {
      const data = await getProjects(organisationId);
      setProjects(data);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadDeliverables = async (projectId: number) => {
    setLoadingDeliverables(true);
    try {
      const data = await getDeliverables(projectId);
      setDeliverables(data);
    } catch (err) {
      console.error('Error loading deliverables:', err);
      setError('Failed to load deliverables');
    } finally {
      setLoadingDeliverables(false);
    }
  };

  const handleOrganisationChange = async (orgId: number) => {
    setSelectedOrganisationId(orgId);
    setSelectedProjectId(null);
    setSelectedDeliverableId(null);
    setProjects([]);
    setDeliverables([]);
    setFormData({ ...formData, deliverable_id: 0 });

    if (orgId) {
      await loadProjects(orgId);
    }
  };

  const handleProjectChange = async (projectId: number) => {
    setSelectedProjectId(projectId);
    setSelectedDeliverableId(null);
    setDeliverables([]);
    setFormData({ ...formData, deliverable_id: 0 });

    if (projectId) {
      await loadDeliverables(projectId);
    }
  };

  const handleDeliverableChange = (deliverableId: number) => {
    setSelectedDeliverableId(deliverableId);
    setFormData({ ...formData, deliverable_id: deliverableId });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFilePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedThumbnail(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setThumbnailPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
    setFormData({ ...formData, tags });
  };

  const handleRoleToggle = (role: string) => {
    const currentRoles = formData.allowed_roles || [];
    if (currentRoles.includes(role)) {
      setFormData({
        ...formData,
        allowed_roles: currentRoles.filter(r => r !== role),
      });
    } else {
      setFormData({
        ...formData,
        allowed_roles: [...currentRoles, role],
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const form = new FormData();

      // Add all form fields
      form.append('deliverable_id', String(formData.deliverable_id));
      form.append('title', formData.title || '');
      form.append('description', formData.description || '');
      form.append('file_type', formData.file_type || 'pdf');
      form.append('category', formData.category || '');
      form.append('version', formData.version || '1.0');
      form.append('status', formData.status || 'draft');
      form.append('is_private', String(formData.is_private || false));

      // Add tags as repeated fields (NOT JSON.stringify — multipart/form-data
      // sends everything as strings, and DRF's JSONField expects either an
      // actual list or a JSON string; repeated keys + getlist() on the
      // backend is the reliable way to send array data through multipart).
      if (formData.tags && formData.tags.length > 0) {
        formData.tags.forEach((tag) => form.append('tags', tag));
      }

      // Add allowed roles as repeated fields — same reasoning as tags above.
      if (formData.allowed_roles && formData.allowed_roles.length > 0) {
        formData.allowed_roles.forEach((role) => form.append('allowed_roles', role));
      }

      // Add file if selected
      if (selectedFile) {
        form.append('file', selectedFile);
      }

      // Add thumbnail if selected
      if (selectedThumbnail) {
        form.append('thumbnail', selectedThumbnail);
      }

      await onSave(form);
    } catch (err: unknown) {
      console.error('Submit error:', err);
      const message = err instanceof Error ? err.message : 'Failed to save document';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="document-form-overlay" onClick={onClose}>
      <div className="document-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="document-form-header">
          <h2 className="document-form-title">{title}</h2>
          <button className="document-form-close" onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        {error && (
          <div className="document-form-error">
            <i className="ti ti-alert-circle" />
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="document-form-body">
          {/* Organisation Dropdown */}
          <div className="form-group">
            <label className="form-label">Organisation *</label>
            <select
              className="form-select"
              value={selectedOrganisationId || ''}
              onChange={(e) => handleOrganisationChange(Number(e.target.value))}
              disabled={loadingOrganisations}
              required
            >
              <option value="">Select Organisation</option>
              {organisations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Dropdown */}
          <div className="form-group">
            <label className="form-label">Project *</label>
            <select
              className="form-select"
              value={selectedProjectId || ''}
              onChange={(e) => handleProjectChange(Number(e.target.value))}
              disabled={!selectedOrganisationId || loadingProjects}
              required
            >
              <option value="">Select Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} (Client: {project.client_name})
                </option>
              ))}
            </select>
          </div>

          {/* Deliverable Dropdown */}
          <div className="form-group">
            <label className="form-label">Deliverable *</label>
            <select
              className="form-select"
              value={selectedDeliverableId || ''}
              onChange={(e) => handleDeliverableChange(Number(e.target.value))}
              disabled={!selectedProjectId || loadingDeliverables}
              required
            >
              <option value="">Select Deliverable</option>
              {deliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.stage_name && `(Stage: ${d.stage_name})`}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              className="form-input"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter document title"
              required
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description"
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="form-group">
            <label className="form-label">Category</label>
            <input
              type="text"
              className="form-input"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g. Architectural, Structural, Electrical"
            />
          </div>

          {/* File Type */}
          <div className="form-group">
            <label className="form-label">File Type *</label>
            <select
              className="form-select"
              value={formData.file_type || 'pdf'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  file_type: e.target.value as DrawingDocumentFormData['file_type'],
                })
              }
              required
            >
              {FILE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div className="form-group">
            <label className="form-label">
              {document ? 'Replace File (optional)' : 'File *'}
            </label>
            <div className="file-upload-area">
              <input
                ref={fileInputRef}
                type="file"
                className="file-input"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.gif,.dxf,.ifc,.doc,.docx,.xls,.xlsx,.txt"
                required={!document}
              />
              <button
                type="button"
                className="file-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="ti ti-upload" />
                {document ? 'Replace File' : 'Choose File'}
              </button>
              {filePreview && (
                <div className="file-preview">
                  {formData.file_type === 'image' ? (
                    <div className="file-preview-image-wrapper">
                      <Image
                        src={filePreview}
                        alt="File preview"
                        fill
                        unoptimized
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                  ) : (
                    <span>{selectedFile?.name || 'File selected'}</span>
                  )}
                  <button
                    type="button"
                    className="file-remove"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail Upload */}
          <div className="form-group">
            <label className="form-label">Thumbnail (optional)</label>
            <div className="file-upload-area">
              <input
                ref={thumbnailInputRef}
                type="file"
                className="file-input"
                onChange={handleThumbnailChange}
                accept=".png,.jpg,.jpeg,.gif,.webp"
              />
              <button
                type="button"
                className="file-upload-btn"
                onClick={() => thumbnailInputRef.current?.click()}
              >
                <i className="ti ti-image" />
                Choose Thumbnail
              </button>
              {thumbnailPreview && (
                <div className="file-preview">
                  <div className="file-preview-image-wrapper">
                    <Image
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      fill
                      unoptimized
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="file-remove"
                    onClick={() => {
                      setSelectedThumbnail(null);
                      setThumbnailPreview(null);
                      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Version */}
          <div className="form-group">
            <label className="form-label">Version</label>
            <input
              type="text"
              className="form-input"
              value={formData.version || '1.0'}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              placeholder="e.g. 1.0, 2.1"
            />
          </div>

          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={formData.status || 'draft'}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as DrawingDocumentFormData['status'],
                })
              }
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="form-group">
            <label className="form-label">Tags (comma separated)</label>
            <input
              type="text"
              className="form-input"
              value={formData.tags?.join(', ') || ''}
              onChange={handleTagChange}
              placeholder="e.g. floor plan, electrical, structural"
            />
          </div>

          {/* Privacy */}
          <div className="form-group">
            <label className="form-label">Privacy</label>
            <div className="privacy-toggle">
              <button
                type="button"
                className={`privacy-btn ${!formData.is_private ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, is_private: false })}
              >
                <i className="ti ti-world" />
                Public
              </button>
              <button
                type="button"
                className={`privacy-btn ${formData.is_private ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, is_private: true })}
              >
                <i className="ti ti-lock" />
                Private
              </button>
            </div>
          </div>

          {/* Allowed Roles (only if private) */}
          {formData.is_private && (
            <div className="form-group">
              <label className="form-label">Allowed Roles</label>
              <div className="roles-grid">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    className={`role-btn ${(formData.allowed_roles || []).includes(role.value) ? 'active' : ''}`}
                    onClick={() => handleRoleToggle(role.value)}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !selectedDeliverableId}
            >
              {loading ? (
                <>
                  <i className="ti ti-loader" />
                  Saving...
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}