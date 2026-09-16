import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";
import { api } from "../components/data/api";
import { uploadToCloudinary } from "../lib/cloudinary";

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const COURSE_TEMPLATES = [
  {
    label: "Professional Acrylic Training",
    template_key: "professional-acrylic-training",
    title: "Professional Acrylic Training",
    slug: "professional-acrylic-training",
    description:
      "Master the art of acrylic nail application with hands-on training in Randfontein. Master prep, application, structure & finishing in 5 days.",
    price: "7200.00",
    image_url: "/professional-acrylic-training-hero.webp",
    duration: "5 Days",
    level: "Beginner to Intermediate",
    course_type: "in-person",
    deposit_amount: "2000.00",
    available_dates: ["March 15-19, 2026", "April 12-16, 2026", "May 10-14, 2026"],
    packages: [
      {
        name: "Standard",
        price: 7200,
        kit_value: 3200,
        features: [
          "5-day comprehensive training",
          "Basic starter kit included",
          "Certificate after you've completed your exam",
          "Course materials and handouts",
        ],
        popular: false,
      },
      {
        name: "Deluxe",
        price: 9900,
        kit_value: 5100,
        features: [
          "5-day comprehensive training",
          "Premium professional kit included",
          "Certificate after you've completed your exam",
          "Course materials and handouts",
          "Bigger kit — electric e-file & LED lamp included",
        ],
        popular: true,
      },
    ],
    key_details: [],
    is_active: true,
  },
  {
    label: "Online Watercolour Workshop",
    template_key: "online-watercolour-workshop",
    title: "Online Watercolour Workshop",
    slug: "online-watercolour-workshop",
    description: "Learn how to create soft, dreamy watercolour designs from the comfort of your home.",
    price: "480.00",
    image_url: "/online-watercolor-card.webp",
    duration: "Self-Paced",
    level: "All Levels",
    course_type: "online",
    is_active: true,
  },
  {
    label: "Christmas Watercolor Workshop",
    template_key: "christmas-watercolor-workshop",
    title: "Christmas Watercolor Workshop",
    slug: "christmas-watercolor-workshop",
    description:
      "Paint festive watercolor nail art for the holidays! Learn Christmas tree designs, snowflakes, and winter wonderland techniques.",
    price: "450.00",
    image_url: "/christmas-watercolor-card.webp",
    duration: "Self-Paced",
    level: "All Levels",
    course_type: "online",
    is_active: true,
  },
];

const initialFormState = {
  template_key: "",
  title: "",
  slug: "",
  description: "",
  price: "",
  duration: "",
  level: "",
  course_type: "in-person",
  is_active: true,
  image_url: "",
  deposit_amount: "",
  available_dates: [],
  packages: [],
  key_details: [],
};

export default function CourseEdit() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState(initialFormState);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadCourse() {
      if (isNew) {
        setLoading(false);
        return;
      }
      if (!api?.getCourse) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const course = await api.getCourse(id);
        if (!isMounted) return;
        if (!course) {
          showToast("error", "Course not found");
          setLoading(false);
          return;
        }
        setForm({
          id: course.id,
          template_key: course.template_key || "",
          title: course.title || "",
          slug: course.slug || "",
          description: course.description || "",
          price: course.price != null ? String(course.price) : "",
          duration: course.duration || "",
          level: course.level || "",
          course_type: course.course_type || "in-person",
          is_active: course.is_active !== false,
          image_url: course.image_url || "",
          deposit_amount: course.deposit_amount != null ? String(course.deposit_amount) : "",
          available_dates: Array.isArray(course.available_dates) ? course.available_dates : [],
          packages: Array.isArray(course.packages)
            ? course.packages.map((p) => ({
                name: p?.name ?? "",
                price: p?.price != null ? String(p.price) : "",
                kit_value: p?.kit_value != null ? String(p.kit_value) : "",
                popular: Boolean(p?.popular),
                features: Array.isArray(p?.features) ? p.features : [],
              }))
            : [],
          key_details: Array.isArray(course.key_details) ? course.key_details : [],
        });
      } catch (error) {
        if (!isMounted) return;
        console.error("Failed to load course:", error);
        showToast("error", "Failed to load course");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCourse();
    return () => {
      isMounted = false;
    };
  }, [id, isNew, showToast]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTitleChange = (value) => {
    update("title", value);
    if (!slugTouched) {
      update("slug", slugify(value));
    }
  };

  const canUpload = useMemo(() => {
    return Boolean(form.slug && form.slug.trim());
  }, [form.slug]);

  const handleImageFile = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      setServerError("");
      showToast("info", "Uploading image to Cloudinary...");
      
      const { hero } = await uploadToCloudinary(file, form.slug || "course");
      update("image_url", hero);
      
      showToast("success", "Image uploaded — click Update Course to save");
    } catch (err) {
      console.error("Upload error:", err);
      showToast("error", err?.message || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const title = String(form.title || "").trim();
    const slug = String(form.slug || "").trim();
    const courseType = String(form.course_type || "").trim();
    if (!title) {
      setServerError("Title is required");
      return;
    }
    if (!slug) {
      setServerError("Slug is required");
      return;
    }
    if (courseType !== "online" && courseType !== "in-person") {
      setServerError("Course Type is required");
      return;
    }

    const availableDates = (Array.isArray(form.available_dates) ? form.available_dates : [])
      .map((d) => String(d ?? "").trim())
      .filter(Boolean);

    const keyDetails = (Array.isArray(form.key_details) ? form.key_details : [])
      .map((d) => String(d ?? "").trim())
      .filter(Boolean);

    const packages = (Array.isArray(form.packages) ? form.packages : [])
      .map((p) => ({
        name: String(p?.name ?? "").trim(),
        price: p?.price === "" || p?.price == null ? null : Number(p.price),
        kit_value: p?.kit_value === "" || p?.kit_value == null ? null : Number(p.kit_value),
        popular: Boolean(p?.popular),
        features: (Array.isArray(p?.features) ? p.features : [])
          .map((f) => String(f ?? "").trim())
          .filter(Boolean),
      }))
      .filter((p) => p.name || p.price != null || p.features.length || p.kit_value != null || p.popular);

    const depositAmount =
      form.deposit_amount === "" || form.deposit_amount == null ? null : Number(form.deposit_amount);

    if (courseType === "in-person") {
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
        setServerError("Deposit amount is required for in-person courses");
        return;
      }
      if (availableDates.length === 0) {
        setServerError("Available dates are required for in-person courses");
        return;
      }
      if (packages.length === 0) {
        setServerError("At least one package is required for in-person courses");
        return;
      }
      for (const pkg of packages) {
        if (!pkg.name) {
          setServerError("Package name is required");
          return;
        }
        if (!Number.isFinite(pkg.price)) {
          setServerError("Package price is required");
          return;
        }
        if (!pkg.features.length) {
          setServerError("Package features are required");
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        id: isNew ? undefined : form.id,
        title,
        slug,
        description: form.description,
        price: form.price,
        duration: form.duration,
        level: form.level,
        is_active: form.is_active,
        image_url: form.image_url,
        course_type: courseType,
        template_key: form.template_key || null,
        deposit_amount: courseType === "in-person" ? String(form.deposit_amount || "") : null,
        available_dates: courseType === "in-person" ? availableDates : null,
        packages: courseType === "in-person" ? packages : null,
        key_details: courseType === "in-person" ? keyDetails : null,
      };

      if (!api?.upsertCourse) {
        throw new Error("Courses API not available");
      }

      await api.upsertCourse(payload);
      showToast("success", isNew ? "Course created" : "Course updated");
      navigate("/courses");
    } catch (err) {
      setServerError(err?.message || "Failed to save course");
      showToast("error", err?.message || "Failed to save course");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "4px solid var(--card)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        ></div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .form-topbar {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 24px 32px;
          border-bottom: 2px solid var(--border);
          background: var(--card);
          margin-bottom: 24px;
        }
        .form-content-area {
          padding: 0 32px 32px;
          overflow-y: auto;
        }
        .product-form-input, .product-form-textarea {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 15px;
          font-family: inherit;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
          transition: box-shadow .2s;
        }
        .product-form-input:focus, .product-form-textarea:focus {
          outline: none;
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
        }
        .product-form-textarea {
          min-height: 120px;
          resize: vertical;
        }
        .product-form-section {
          background: var(--card);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          margin-bottom: 24px;
        }
        .product-form-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-muted);
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .product-btn-primary {
          padding: 12px 28px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          transition: transform 0.2s;
        }
        .product-btn-primary:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        .product-btn-primary:not(:disabled):hover {
          transform: translateY(-2px);
        }
        .product-btn-secondary {
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }
        .product-btn-secondary:hover {
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }
        .upload-btn {
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 3px 3px 6px var(--shadow-dark);
        }
        .image-preview {
          margin-top: 12px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--bg);
          width: 180px;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .image-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>

      <div className="form-topbar">
        <button
          type="button"
          className="product-btn-secondary"
          onClick={() => navigate("/courses")}
          disabled={isSubmitting}
        >
          <span className="inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Courses
          </span>
        </button>
      </div>

      <div className="form-content-area">
        <form onSubmit={handleSubmit}>
          <section className="product-form-section">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isNew ? (
                <div className="md:col-span-2">
                  <label className="product-form-label" htmlFor="template_key">
                    Start from Template
                  </label>
                  <select
                    id="template_key"
                    className="product-form-input"
                    value={form.template_key}
                    onChange={(e) => {
                      const key = e.target.value;
                      if (!key) {
                        update("template_key", "");
                        return;
                      }
                      const template = COURSE_TEMPLATES.find((t) => t.template_key === key);
                      if (!template) return;
                      setSlugTouched(true);
                      setForm((prev) => ({
                        ...prev,
                        template_key: template.template_key,
                        title: template.title,
                        slug: template.slug,
                        description: template.description,
                        price: template.price,
                        image_url: template.image_url,
                        duration: template.duration,
                        level: template.level,
                        is_active: template.is_active,
                        course_type: template.course_type,
                      deposit_amount: template.deposit_amount != null ? String(template.deposit_amount) : "",
                      available_dates: Array.isArray(template.available_dates) ? template.available_dates : [],
                      packages: Array.isArray(template.packages)
                        ? template.packages.map((p) => ({
                            name: p?.name ?? "",
                            price: p?.price != null ? String(p.price) : "",
                            kit_value: p?.kit_value != null ? String(p.kit_value) : "",
                            popular: Boolean(p?.popular),
                            features: Array.isArray(p?.features) ? p.features : [],
                          }))
                        : [],
                      key_details: Array.isArray(template.key_details) ? template.key_details : [],
                      }));
                    }}
                  >
                    <option value="">None</option>
                    {COURSE_TEMPLATES.map((t) => (
                      <option key={t.template_key} value={t.template_key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="product-form-label" htmlFor="title">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  className="product-form-input"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Course title"
                />
              </div>

              <div>
                <label className="product-form-label" htmlFor="slug">
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  id="slug"
                  className="product-form-input"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update("slug", slugify(e.target.value));
                  }}
                  placeholder="online-acrylic-workshop"
                />
              </div>

              <div className="md:col-span-2">
                <label className="product-form-label" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  className="product-form-textarea"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Course description"
                />
              </div>
            </div>
          </section>

          <section className="product-form-section">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="product-form-label" htmlFor="price">
                  Price
                </label>
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  className="product-form-input"
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="product-form-label" htmlFor="duration">
                  Duration
                </label>
                <input
                  id="duration"
                  className="product-form-input"
                  value={form.duration}
                  onChange={(e) => update("duration", e.target.value)}
                  placeholder="Online • 8 hours"
                />
              </div>

              <div>
                <label className="product-form-label" htmlFor="level">
                  Level
                </label>
                <input
                  id="level"
                  className="product-form-input"
                  value={form.level}
                  onChange={(e) => update("level", e.target.value)}
                  placeholder="Beginner"
                />
              </div>

              <div>
                <label className="product-form-label" htmlFor="course_type">
                  Course Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="course_type"
                  className="product-form-input"
                  value={form.course_type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    if (nextType === "online") {
                      setForm((prev) => ({
                        ...prev,
                        course_type: nextType,
                        deposit_amount: "",
                        available_dates: [],
                        packages: [],
                        key_details: [],
                      }));
                      return;
                    }
                    update("course_type", nextType);
                  }}
                >
                  <option value="online">Online</option>
                  <option value="in-person">In-Person</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label className="flex items-center gap-3 text-sm font-medium text-[var(--text)]" htmlFor="is_active">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => update("is_active", e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--card)]"
                />
                Active
              </label>
            </div>
          </section>

          {form.course_type === "in-person" ? (
            <section className="product-form-section">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="product-form-label" htmlFor="deposit_amount">
                    Deposit Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="deposit_amount"
                    type="number"
                    step="0.01"
                    className="product-form-input"
                    value={form.deposit_amount}
                    onChange={(e) => update("deposit_amount", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mt-8">
                <label className="product-form-label">
                  Available Dates <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-3">
                  {(form.available_dates || []).map((d, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <input
                        className="product-form-input"
                        value={d}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => {
                            const next = [...(prev.available_dates || [])];
                            next[idx] = value;
                            return { ...prev, available_dates: next };
                          });
                        }}
                        placeholder="March 15-19, 2026"
                      />
                      <button
                        type="button"
                        className="product-btn-secondary"
                        onClick={() => {
                          setForm((prev) => {
                            const next = [...(prev.available_dates || [])];
                            next.splice(idx, 1);
                            return { ...prev, available_dates: next };
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      className="product-btn-secondary"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, available_dates: [...(prev.available_dates || []), ""] }));
                      }}
                    >
                      Add date
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <label className="product-form-label">
                  Packages <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-6">
                  {(form.packages || []).map((pkg, pkgIndex) => (
                    <div
                      key={pkgIndex}
                      style={{
                        borderRadius: 16,
                        border: "1px solid var(--border)",
                        padding: 18,
                        background: "var(--bg)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="text-sm font-semibold text-[var(--text)]">Package {pkgIndex + 1}</div>
                        <button
                          type="button"
                          className="product-btn-secondary"
                          onClick={() => {
                            setForm((prev) => {
                              const next = [...(prev.packages || [])];
                              next.splice(pkgIndex, 1);
                              return { ...prev, packages: next };
                            });
                          }}
                        >
                          Remove package
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <label className="product-form-label">Name</label>
                          <input
                            className="product-form-input"
                            value={pkg?.name ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setForm((prev) => {
                                const next = [...(prev.packages || [])];
                                const current = next[pkgIndex] || {};
                                next[pkgIndex] = { ...current, name: value };
                                return { ...prev, packages: next };
                              });
                            }}
                            placeholder="Standard"
                          />
                        </div>

                        <div>
                          <label className="product-form-label">Price</label>
                          <input
                            type="number"
                            className="product-form-input"
                            value={pkg?.price ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setForm((prev) => {
                                const next = [...(prev.packages || [])];
                                const current = next[pkgIndex] || {};
                                next[pkgIndex] = { ...current, price: value };
                                return { ...prev, packages: next };
                              });
                            }}
                            placeholder="7200"
                          />
                        </div>

                        <div>
                          <label className="product-form-label">Kit Value</label>
                          <input
                            type="number"
                            className="product-form-input"
                            value={pkg?.kit_value ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setForm((prev) => {
                                const next = [...(prev.packages || [])];
                                const current = next[pkgIndex] || {};
                                next[pkgIndex] = { ...current, kit_value: value };
                                return { ...prev, packages: next };
                              });
                            }}
                            placeholder="3200"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="flex items-center gap-3 text-sm font-medium text-[var(--text)]">
                          <input
                            type="checkbox"
                            checked={Boolean(pkg?.popular)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setForm((prev) => {
                                const next = [...(prev.packages || [])];
                                const current = next[pkgIndex] || {};
                                next[pkgIndex] = { ...current, popular: checked };
                                return { ...prev, packages: next };
                              });
                            }}
                            className="h-4 w-4 rounded border-[var(--card)]"
                          />
                          Popular
                        </label>
                      </div>

                      <div className="mt-6">
                        <label className="product-form-label">Features</label>
                        <div className="flex flex-col gap-3">
                          {(pkg?.features || []).map((feature, featureIndex) => (
                            <div key={featureIndex} className="flex items-center gap-3">
                              <input
                                className="product-form-input"
                                value={feature}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setForm((prev) => {
                                    const next = [...(prev.packages || [])];
                                    const current = next[pkgIndex] || {};
                                    const nextFeatures = [...(current.features || [])];
                                    nextFeatures[featureIndex] = value;
                                    next[pkgIndex] = { ...current, features: nextFeatures };
                                    return { ...prev, packages: next };
                                  });
                                }}
                                placeholder="Feature"
                              />
                              <button
                                type="button"
                                className="product-btn-secondary"
                                onClick={() => {
                                  setForm((prev) => {
                                    const next = [...(prev.packages || [])];
                                    const current = next[pkgIndex] || {};
                                    const nextFeatures = [...(current.features || [])];
                                    nextFeatures.splice(featureIndex, 1);
                                    next[pkgIndex] = { ...current, features: nextFeatures };
                                    return { ...prev, packages: next };
                                  });
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <div>
                            <button
                              type="button"
                              className="product-btn-secondary"
                              onClick={() => {
                                setForm((prev) => {
                                  const next = [...(prev.packages || [])];
                                  const current = next[pkgIndex] || {};
                                  const nextFeatures = [...(current.features || [])];
                                  nextFeatures.push("");
                                  next[pkgIndex] = { ...current, features: nextFeatures };
                                  return { ...prev, packages: next };
                                });
                              }}
                            >
                              Add feature
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div>
                    <button
                      type="button"
                      className="product-btn-secondary"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          packages: [
                            ...(prev.packages || []),
                            { name: "", price: "", kit_value: "", popular: false, features: [""] },
                          ],
                        }));
                      }}
                    >
                      Add package
                    </button>
                  </div>
                </div>
              </div>

            </section>
          ) : null}

          <section className="product-form-section">
            <div className="flex flex-col gap-3">
              <div>
                <label className="product-form-label">Image</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="upload-btn">
                    <Upload className="w-4 h-4" />
                    {uploading ? "Uploading..." : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading || !canUpload}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        handleImageFile(file);
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                  {!canUpload && (
                    <div className="text-sm text-[var(--text-muted)]">Set a slug before uploading</div>
                  )}
                </div>
              </div>

              {form.image_url ? (
                <div>
                  <div className="text-sm text-[var(--text-muted)] break-all">{form.image_url}</div>
                  <div className="image-preview">
                    <img src={form.image_url} alt={form.title || "Course image"} />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {serverError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 mb-6">
              {serverError}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="product-btn-secondary"
              onClick={() => navigate("/courses")}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="product-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isNew ? "Create Course" : "Update Course"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
