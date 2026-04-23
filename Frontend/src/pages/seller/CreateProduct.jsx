import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Plus, Check, ChevronRight,
  ChevronLeft, Package, Image as ImageIcon,
  Settings, Eye, Zap, Trash2, GripVertical,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { productsApi } from '../../api/products.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Badge } from '../../components/ui/Badge';
import { CATEGORIES, CONDITIONS } from '../../utils/constants';
import { formatPrice, getConditionColor } from '../../utils/format';

// ── Validation schema ─────────────────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().min(10, 'Minimum 10 characters').max(150),
  description: z.string().min(30, 'Minimum 30 characters').max(3000),
  category: z.string().min(1, 'Select a category'),
  brand: z.string().min(1, 'Brand required').max(50),
  model: z.string().max(100).optional(),
  condition: z.string().min(1, 'Select condition'),
  price: z.number({ invalid_type_error: 'Enter a valid price' }).min(1).max(10000000),
  location: z.object({
    city: z.string().max(50).optional(),
    state: z.string().max(50).optional(),
  }).optional(),
  status: z.enum(['active', 'draft']).default('active'),
});

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Details', icon: Package },
  { id: 2, label: 'Images', icon: ImageIcon },
  { id: 3, label: 'Specs', icon: Settings },
  { id: 4, label: 'Preview', icon: Eye },
];

// ── Step indicator ────────────────────────────────────────────────────────────
const StepBar = ({ currentStep }) => (
  <div className="flex items-center justify-center gap-0 mb-8">
    {STEPS.map((step, i) => {
      const isDone = step.id < currentStep;
      const isActive = step.id === currentStep;

      return (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <motion.div
              animate={{
                backgroundColor: isDone || isActive ? '#2563eb' : '#f1f5f9',
                scale: isActive ? 1.1 : 1,
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm"
            >
              {isDone ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <step.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              )}
            </motion.div>
            <span className={`text-xs mt-1.5 font-medium ${isActive || isDone ? 'text-primary-600' : 'text-slate-400'}`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-16 h-0.5 mx-1 mb-5 transition-all duration-500 ${isDone ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
          )}
        </div>
      );
    })}
  </div>
);

// ── Image uploader ────────────────────────────────────────────────────────────
const ImageUploader = ({ images, onAdd, onRemove, onSetPrimary }) => {
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    const validFiles = Array.from(files).filter((f) => {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name}: Max size is 5MB`);
        return false;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        toast.error(`${f.name}: Only JPG, PNG, WebP allowed`);
        return false;
      }
      return true;
    });

    if (images.length + validFiles.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    const newImages = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      isPrimary: images.length === 0,
    }));

    onAdd(newImages);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
          ${dragging
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-primary-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }
          ${images.length >= 5 ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <Upload className={`w-10 h-10 mx-auto mb-3 ${dragging ? 'text-primary-500' : 'text-slate-300'}`} />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {dragging ? 'Drop images here' : 'Drop images or click to upload'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          JPG, PNG, WebP • Max 5MB each • Up to 5 images
        </p>
      </div>

      {/* Image previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          <AnimatePresence>
            {images.map((img, i) => (
              <motion.div
                key={img.preview}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative group aspect-square"
              >
                <img
                  src={img.preview}
                  alt=""
                  className={`w-full h-full object-cover rounded-xl border-2 transition-all ${
                    img.isPrimary
                      ? 'border-primary-500 shadow-md'
                      : 'border-transparent'
                  }`}
                />

                {/* Primary badge */}
                {img.isPrimary && (
                  <div className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-md bg-primary-600 text-white text-[10px] font-bold">
                    Cover
                  </div>
                )}

                {/* Hover controls */}
                <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {!img.isPrimary && (
                    <button
                      onClick={() => onSetPrimary(i)}
                      className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                      title="Set as cover"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(i)}
                    className="w-7 h-7 rounded-lg bg-red-500/80 backdrop-blur-sm flex items-center justify-center text-white hover:bg-red-500 transition-colors"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add more */}
          {images.length < 5 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-primary-300 transition-colors"
            >
              <Plus className="w-6 h-6 text-slate-300 dark:text-slate-600" />
            </button>
          )}
        </div>
      )}

      {images.length === 0 && (
        <p className="text-xs text-center text-slate-400">
          First image will be the cover photo
        </p>
      )}
    </div>
  );
};

// ── Specs builder ─────────────────────────────────────────────────────────────
const SpecsBuilder = ({ specs, onChange }) => {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const QUICK_SPECS = [
    { key: 'ram_gb', label: 'RAM (GB)', placeholder: '8' },
    { key: 'storage_gb', label: 'Storage (GB)', placeholder: '256' },
    { key: 'battery_mah', label: 'Battery (mAh)', placeholder: '5000' },
    { key: 'display_inch', label: 'Display (inch)', placeholder: '6.7' },
    { key: 'age_months', label: 'Age (months)', placeholder: '6' },
    { key: 'processor', label: 'Processor', placeholder: 'Snapdragon 8 Gen 2' },
  ];

  const addSpec = (k, v) => {
    if (!k || !v) return;
    onChange({ ...specs, [k]: v });
    setKey('');
    setValue('');
  };

  const removeSpec = (k) => {
    const updated = { ...specs };
    delete updated[k];
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Add technical specs to help buyers and improve AI price accuracy
      </p>

      {/* Quick add buttons */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          Quick Add
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_SPECS.filter((s) => !(s.key in specs)).map((spec) => (
            <button
              key={spec.key}
              type="button"
              onClick={() => {
                setKey(spec.key);
                setValue('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                key === spec.key
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              + {spec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom spec input */}
      <div className="flex gap-2">
        <input
          placeholder="Key (e.g. processor)"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="input-base text-sm flex-1"
        />
        <input
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSpec(key, value)}
          className="input-base text-sm flex-1"
        />
        <Button
          type="button"
          icon={Plus}
          size="sm"
          disabled={!key || !value}
          onClick={() => addSpec(key, value)}
        >
          Add
        </Button>
      </div>

      {/* Current specs */}
      {Object.keys(specs).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Added Specs ({Object.keys(specs).length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(specs).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 group"
              >
                <div className="min-w-0 mr-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {k.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {String(v)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSpec(k)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Product preview card ──────────────────────────────────────────────────────
const PreviewCard = ({ formData, images }) => {
  const primaryPreview = images.find((i) => i.isPrimary)?.preview || images[0]?.preview;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        This is how your listing will appear to buyers
      </p>

      <div className="max-w-xs mx-auto card overflow-hidden">
        <div className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden">
          {primaryPreview ? (
            <img src={primaryPreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Package className="w-12 h-12 text-slate-300" />
              <p className="text-xs text-slate-400">No images yet</p>
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 uppercase">
              {formData.brand || 'Brand'}
            </span>
            {formData.condition && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConditionColor(formData.condition)}`}>
                {formData.condition}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 mb-2">
            {formData.title || 'Product Title'}
          </h3>
          <p className="text-lg font-bold text-primary-600">
            {formData.price ? formatPrice(formData.price) : '₹0'}
          </p>
          {formData.location?.city && (
            <p className="text-xs text-slate-400 mt-1">
              📍 {formData.location.city}
            </p>
          )}
        </div>
      </div>

      {/* Specs summary */}
      {formData.specs && Object.keys(formData.specs).length > 0 && (
        <div className="card p-4 max-w-xs mx-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Specifications
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(formData.specs).slice(0, 6).map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-slate-400 capitalize">{k.replace(/_/g, ' ')}: </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI note */}
      <div className="max-w-xs mx-auto flex items-center gap-2 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30">
        <Zap className="w-4 h-4 text-primary-600 flex-shrink-0" />
        <p className="text-xs text-primary-700 dark:text-primary-400">
          AI price analysis will be available shortly after publishing
        </p>
      </div>
    </div>
  );
};

// ── Main Create Product page ──────────────────────────────────────────────────
export default function CreateProduct() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [images, setImages] = useState([]);
  const [specs, setSpecs] = useState({});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      status: 'active',
      location: { city: '', state: '' },
    },
  });

  const formData = watch();

  // ── Create product mutation ───────────────────────────────────────────────
  const { mutate: createProduct, isPending } = useMutation({
    mutationFn: async (data) => {
      const formDataPayload = new FormData();

      // Append text fields
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'location') {
          if (value?.city) formDataPayload.append('location[city]', value.city);
          if (value?.state) formDataPayload.append('location[state]', value.state);
        } else if (key === 'specs') {
          formDataPayload.append('specs', JSON.stringify(value));
        } else if (value !== undefined && value !== '') {
          formDataPayload.append(key, String(value));
        }
      });

      // Append specs separately
      if (Object.keys(specs).length > 0) {
        formDataPayload.set('specs', JSON.stringify(specs));
      }

      // Append images
      images.forEach((img) => {
        formDataPayload.append('images', img.file);
      });

      return productsApi.create(formDataPayload);
    },
    onSuccess: (res) => {
      toast.success('Listing created! AI price analysis in progress...');
      navigate('/seller');
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Failed to create listing';
      toast.error(msg);
    },
  });

  const nextStep = async () => {
    let fieldsToValidate = [];

    if (currentStep === 1) {
      fieldsToValidate = ['title', 'description', 'category', 'brand', 'condition', 'price'];
    }

    const valid = await trigger(fieldsToValidate);
    if (valid) setCurrentStep((p) => p + 1);
  };

  const prevStep = () => setCurrentStep((p) => p - 1);

  const handleAddImages = (newImgs) => {
    setImages((prev) => {
      const updated = [...prev, ...newImgs];
      // Only one primary
      return updated.map((img, i) => ({
        ...img,
        isPrimary: i === 0 || img.isPrimary,
      }));
    });
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // If removed was primary, set first as primary
      if (prev[index].isPrimary && updated.length > 0) {
        updated[0].isPrimary = true;
      }
      return updated;
    });
  };

  const handleSetPrimary = (index) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, isPrimary: i === index }))
    );
  };

  const onSubmit = (data) => {
    createProduct({ ...data, specs });
  };

  return (
    <PageWrapper>
      <div className="container-page py-8 pb-20 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create Listing
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              List your device and get AI-powered price insights
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate('/seller')}
          >
            Cancel
          </Button>
        </div>

        {/* Step bar */}
        <StepBar currentStep={currentStep} />

        <div className="card p-6">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Details ─────────────────────────────────────────── */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <h2 className="font-bold text-slate-900 dark:text-white text-lg mb-5">
                  Product Details
                </h2>

                <Input
                  label="Title"
                  placeholder="e.g. iPhone 14 Pro Max 256GB Deep Purple"
                  error={errors.title?.message}
                  required
                  hint="Be specific — include brand, model, storage, color"
                  {...register('title')}
                />

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    placeholder="Describe the device condition, accessories included, reason for selling..."
                    rows={4}
                    className={`input-base resize-none ${errors.description ? 'border-red-400' : ''}`}
                    {...register('description')}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {errors.description ? (
                      <p className="text-xs text-red-500">{errors.description.message}</p>
                    ) : (
                      <p className="text-xs text-slate-400">Min 30 characters</p>
                    )}
                    <p className="text-xs text-slate-400">
                      {watch('description')?.length || 0}/3000
                    </p>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setValue('category', cat.value, { shouldValidate: true })}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          watch('category') === cat.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xl mb-1">{cat.icon}</div>
                        <p className={`text-[10px] font-medium leading-tight ${
                          watch('category') === cat.value
                            ? 'text-primary-700 dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {cat.label}
                        </p>
                      </button>
                    ))}
                  </div>
                  {errors.category && (
                    <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>
                  )}
                </div>

                {/* Brand + Model */}
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Brand"
                    placeholder="Apple, Samsung, Sony..."
                    error={errors.brand?.message}
                    required
                    {...register('brand')}
                  />
                  <Input
                    label="Model (optional)"
                    placeholder="e.g. A2894"
                    {...register('model')}
                  />
                </div>

                {/* Condition */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-2">
                    Condition <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {CONDITIONS.map((cond) => (
                      <button
                        key={cond.value}
                        type="button"
                        onClick={() => setValue('condition', cond.value, { shouldValidate: true })}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          watch('condition') === cond.value
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <p className={`text-xs font-semibold ${
                          watch('condition') === cond.value
                            ? 'text-primary-700 dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {cond.label}
                        </p>
                      </button>
                    ))}
                  </div>
                  {errors.condition && (
                    <p className="text-xs text-red-500 mt-1">{errors.condition.message}</p>
                  )}
                </div>

                {/* Price + Location */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-1.5">
                      Asking Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₹</span>
                      <input
                        type="number"
                        placeholder="25000"
                        className={`input-base pl-7 ${errors.price ? 'border-red-400' : ''}`}
                        {...register('price', { valueAsNumber: true })}
                      />
                    </div>
                    {errors.price && (
                      <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Input
                      label="City (optional)"
                      placeholder="Mumbai"
                      {...register('location.city')}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Publish immediately
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Uncheck to save as draft
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setValue('status', watch('status') === 'active' ? 'draft' : 'active')}
                    className={`w-12 h-6 rounded-full transition-all duration-300 ${
                      watch('status') === 'active'
                        ? 'bg-primary-600'
                        : 'bg-slate-300 dark:bg-slate-600'
                    } relative`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                      watch('status') === 'active' ? 'left-6' : 'left-0.5'
                    }`} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Images ───────────────────────────────────────────── */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="font-bold text-slate-900 dark:text-white text-lg mb-5">
                  Product Images
                </h2>
                <ImageUploader
                  images={images}
                  onAdd={handleAddImages}
                  onRemove={handleRemoveImage}
                  onSetPrimary={handleSetPrimary}
                />
              </motion.div>
            )}

            {/* ── Step 3: Specs ────────────────────────────────────────────── */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="font-bold text-slate-900 dark:text-white text-lg mb-5">
                  Technical Specifications
                  <span className="ml-2 text-sm font-normal text-slate-400">(optional)</span>
                </h2>
                <SpecsBuilder specs={specs} onChange={setSpecs} />
              </motion.div>
            )}

            {/* ── Step 4: Preview ──────────────────────────────────────────── */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="font-bold text-slate-900 dark:text-white text-lg mb-5">
                  Preview & Publish
                </h2>
                <PreviewCard formData={{ ...formData, specs }} images={images} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Navigation ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              icon={ChevronLeft}
            >
              Back
            </Button>

            {currentStep < 4 ? (
              <Button
                onClick={nextStep}
                icon={ChevronRight}
                iconPosition="right"
              >
                Continue
              </Button>
            ) : (
              <Button
                loading={isPending}
                icon={Check}
                onClick={handleSubmit(onSubmit)}
                className="shadow-lg shadow-primary-600/20"
              >
                {formData.status === 'draft' ? 'Save as Draft' : 'Publish Listing'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}