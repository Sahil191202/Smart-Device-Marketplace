import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, ArrowLeft, Trash2, Upload, X,
  Plus, Check, Eye, EyeOff, Zap,
  AlertTriangle, Image as ImageIcon,
  RefreshCw, Package,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { productsApi } from '../../api/products.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { DealScore } from '../../components/shared/DealScore';
import { CATEGORIES, CONDITIONS } from '../../utils/constants';
import { formatPrice, getConditionColor } from '../../utils/format';

const editSchema = z.object({
  title: z.string().min(10, 'Min 10 characters').max(150).optional(),
  description: z.string().min(30, 'Min 30 characters').max(3000).optional(),
  category: z.string().optional(),
  brand: z.string().max(50).optional(),
  model: z.string().max(100).optional(),
  condition: z.string().optional(),
  price: z.number({ invalid_type_error: 'Enter a valid price' }).min(1).optional(),
  status: z.enum(['active', 'draft', 'sold']).optional(),
  location: z.object({
    city: z.string().max(50).optional(),
    state: z.string().max(50).optional(),
  }).optional(),
});

// ── Image manager ─────────────────────────────────────────────────────────────
const ImageManager = ({ productId, images, onUpdate }) => {
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState(null);

  const { mutate: addImages, isPending: uploading } = useMutation({
    mutationFn: (formData) => productsApi.addImages(productId, formData),
    onSuccess: (res) => {
      onUpdate(res.data.data.product.images);
      queryClient.invalidateQueries({ queryKey: ['product'] });
      toast.success('Images added!');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Upload failed'),
  });

  const { mutate: removeImage } = useMutation({
    mutationFn: (imageId) => productsApi.removeImage(productId, imageId),
    onMutate: (id) => setRemovingId(id),
    onSuccess: (res) => {
      onUpdate(res.data.data.product.images);
      toast.success('Image removed');
    },
    onError: () => toast.error('Failed to remove image'),
    onSettled: () => setRemovingId(null),
  });

  const { mutate: setPrimary } = useMutation({
    mutationFn: (imageId) => productsApi.setPrimaryImage(productId, imageId),
    onMutate: (id) => setSettingPrimaryId(id),
    onSuccess: (res) => {
      onUpdate(res.data.data.product.images);
      toast.success('Cover image updated');
    },
    onError: () => toast.error('Failed to set cover'),
    onSettled: () => setSettingPrimaryId(null),
  });

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    addImages(formData);
    e.target.value = '';
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary-600" />
          Images ({images.length}/5)
        </h3>
        {images.length < 5 && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              icon={uploading ? RefreshCw : Upload}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Add Images
            </Button>
          </>
        )}
      </div>

      {images.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-primary-300 transition-colors"
        >
          <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Upload product images</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          <AnimatePresence>
            {images.map((img) => (
              <motion.div
                key={img._id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative group aspect-square"
              >
                <img
                  src={img.url}
                  alt=""
                  className={`w-full h-full object-cover rounded-xl border-2 transition-all ${
                    img.isPrimary
                      ? 'border-primary-500 shadow-md'
                      : 'border-transparent'
                  }`}
                />

                {img.isPrimary && (
                  <div className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 rounded-md bg-primary-600 text-white text-[10px] font-bold">
                    Cover
                  </div>
                )}

                <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {!img.isPrimary && (
                    <button
                      onClick={() => setPrimary(img._id)}
                      disabled={settingPrimaryId === img._id}
                      className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30"
                      title="Set as cover"
                    >
                      {settingPrimaryId === img._id
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Check className="w-3.5 h-3.5" />
                      }
                    </button>
                  )}
                  <button
                    onClick={() => removeImage(img._id)}
                    disabled={removingId === img._id || images.length === 1}
                    className="w-7 h-7 rounded-lg bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500 disabled:opacity-40"
                    title="Remove"
                  >
                    {removingId === img._id
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
              </motion.div>
            ))}

            {images.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-primary-300 transition-colors"
              >
                <Plus className="w-5 h-5 text-slate-300" />
              </button>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// ── Main Edit Product ─────────────────────────────────────────────────────────
export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [images, setImages] = useState([]);
  const [specs, setSpecs] = useState({});

  // Fetch product
  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', 'edit', id],
    queryFn: () => productsApi.getById(id),
    onSuccess: (res) => {
      const p = res.data.data.product;
      setImages(p.images || []);
      setSpecs(p.specs || {});
      reset({
        title: p.title,
        description: p.description,
        category: p.category,
        brand: p.brand,
        model: p.model || '',
        condition: p.condition,
        price: p.price,
        status: p.status,
        location: p.location || { city: '', state: '' },
      });
    },
  });

  const product = productData?.data?.data?.product;

  // Fetch AI analysis
  const { data: analysisData, isLoading: analysisLoading } = useQuery({
    queryKey: ['priceAnalysis', id],
    queryFn: () => productsApi.getPriceAnalysis(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 30,
  });

  const analysis = analysisData?.data?.data;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(editSchema),
  });

  // Update product
  const { mutate: updateProduct, isPending: updating } = useMutation({
    mutationFn: (data) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['seller', 'listings'] });
      toast.success('Listing updated!');
      navigate('/seller');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  });

  // Delete product
  const { mutate: deleteProduct, isPending: deleting } = useMutation({
    mutationFn: () => productsApi.delete(id),
    onSuccess: () => {
      toast.success('Listing removed');
      navigate('/seller');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to remove'),
  });

  const onSubmit = (data) => {
    const payload = { ...data };
    if (Object.keys(specs).length > 0) payload.specs = specs;
    updateProduct(payload);
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="container-page py-8 max-w-3xl mx-auto space-y-5">
          <div className="shimmer h-10 w-48 rounded-xl" />
          <div className="shimmer h-96 rounded-2xl" />
        </div>
      </PageWrapper>
    );
  }

  if (!product) {
    return (
      <PageWrapper>
        <div className="container-page py-20 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Product not found
          </h2>
          <Button onClick={() => navigate('/seller')} icon={ArrowLeft}>
            Back to Dashboard
          </Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container-page py-8 pb-20 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/seller')}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Edit Listing
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                #{id?.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={Eye}
              onClick={() => navigate(`/products/${product.slug}`)}
            >
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              loading={deleting}
              className="!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20"
              onClick={() => {
                if (window.confirm('Remove this listing? This cannot be undone.')) {
                  deleteProduct();
                }
              }}
            >
              Remove
            </Button>
          </div>
        </div>

        <div className="space-y-6">

          {/* AI Price Analysis */}
          <DealScore analysis={analysis} loading={analysisLoading} />

          {/* Status toggle */}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Listing Status
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Control visibility of your listing
                </p>
              </div>
              <div className="flex gap-2">
                {['active', 'draft', 'sold'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setValue('status', s, { shouldDirty: true })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-all ${
                      watch('status') === s
                        ? s === 'active' ? 'bg-green-500 text-white border-green-500'
                          : s === 'draft' ? 'bg-yellow-500 text-white border-yellow-500'
                          : 'bg-slate-500 text-white border-slate-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main form */}
          <form onSubmit={handleSubmit(onSubmit)} className="card p-5 space-y-5">
            <h2 className="font-bold text-slate-900 dark:text-white">
              Product Details
            </h2>

            <Input
              label="Title"
              error={errors.title?.message}
              {...register('title')}
            />

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-1.5">
                Description
              </label>
              <textarea
                rows={4}
                className={`input-base resize-none ${errors.description ? 'border-red-400' : ''}`}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-2">
                Category
              </label>
              <div className="grid grid-cols-5 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setValue('category', cat.value, { shouldDirty: true })}
                    className={`p-2 rounded-xl border text-center text-xs transition-all ${
                      watch('category') === cat.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{cat.icon}</div>
                    <span className="leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Condition */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-2">
                Condition
              </label>
              <div className="flex gap-2 flex-wrap">
                {CONDITIONS.map((cond) => (
                  <button
                    key={cond.value}
                    type="button"
                    onClick={() => setValue('condition', cond.value, { shouldDirty: true })}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                      watch('condition') === cond.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cond.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand + Model */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Brand"
                error={errors.brand?.message}
                {...register('brand')}
              />
              <Input
                label="Model (optional)"
                {...register('model')}
              />
            </div>

            {/* Price */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-1.5">
                Asking Price (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₹</span>
                <input
                  type="number"
                  className={`input-base pl-7 ${errors.price ? 'border-red-400' : ''}`}
                  {...register('price', { valueAsNumber: true })}
                />
              </div>
              {errors.price && (
                <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>
              )}
              {analysis?.predicted_price && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary-500" />
                  AI fair price: {formatPrice(analysis.predicted_price)}
                </p>
              )}
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City (optional)"
                {...register('location.city')}
              />
              <Input
                label="State (optional)"
                {...register('location.state')}
              />
            </div>

            {/* Specs */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-2">
                Specifications
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(specs).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 group text-sm">
                    <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}: </span>
                    <span className="font-medium text-slate-900 dark:text-white">{String(v)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...specs };
                        delete updated[k];
                        setSpecs(updated);
                      }}
                      className="ml-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" fullWidth onClick={() => navigate('/seller')} type="button">
                Cancel
              </Button>
              <Button
                type="submit"
                fullWidth
                loading={updating}
                disabled={!isDirty}
                icon={Save}
              >
                Save Changes
              </Button>
            </div>
          </form>

          {/* Image manager */}
          <ImageManager
            productId={id}
            images={images}
            onUpdate={setImages}
          />
        </div>
      </div>
    </PageWrapper>
  );
}