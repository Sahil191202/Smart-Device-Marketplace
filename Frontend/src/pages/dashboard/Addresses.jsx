import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Pencil, Trash2,
  Check, Star, Home, Briefcase, X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { usersApi } from '../../api/users.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

const addressSchema = z.object({
  label: z.string().max(30).default('Home'),
  line1: z.string().min(5, 'Enter a valid address').max(100),
  line2: z.string().max(100).optional().default(''),
  city: z.string().min(2, 'City required').max(50),
  state: z.string().min(2, 'State required').max(50),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  country: z.string().default('India'),
  isDefault: z.boolean().default(false),
});

// ── Label icon ────────────────────────────────────────────────────────────────
const LabelIcon = ({ label }) => {
  const lower = label?.toLowerCase();
  if (lower?.includes('home')) return <Home className="w-4 h-4" />;
  if (lower?.includes('work') || lower?.includes('office')) return <Briefcase className="w-4 h-4" />;
  return <MapPin className="w-4 h-4" />;
};

// ── Address form ──────────────────────────────────────────────────────────────
const AddressForm = ({ defaultValues, onSubmit, onCancel, saving }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: defaultValues || {
      label: 'Home',
      country: 'India',
      isDefault: false,
    },
  });

  const QUICK_LABELS = ['Home', 'Work', 'Other'];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Label quick select */}
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-2">
          Address Label
        </label>
        <div className="flex gap-2 mb-2">
          {QUICK_LABELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setValue('label', l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                watch('label') === l
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          placeholder="Custom label..."
          className={`input-base text-sm ${errors.label ? 'border-red-400' : ''}`}
          {...register('label')}
        />
      </div>

      <Input
        label="Address Line 1"
        placeholder="Flat/House no, Building, Street"
        error={errors.line1?.message}
        required
        {...register('line1')}
      />

      <Input
        label="Address Line 2 (optional)"
        placeholder="Area, Landmark, Colony"
        {...register('line2')}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="City"
          placeholder="Mumbai"
          error={errors.city?.message}
          required
          {...register('city')}
        />
        <Input
          label="State"
          placeholder="Maharashtra"
          error={errors.state?.message}
          required
          {...register('state')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Pincode"
          placeholder="400001"
          error={errors.pincode?.message}
          required
          {...register('pincode')}
        />
        <Input
          label="Country"
          placeholder="India"
          {...register('country')}
        />
      </div>

      {/* Default toggle */}
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <div
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            watch('isDefault')
              ? 'bg-primary-600 border-primary-600'
              : 'border-slate-300 dark:border-slate-600'
          }`}
          onClick={() => setValue('isDefault', !watch('isDefault'))}
        >
          {watch('isDefault') && <Check className="w-3 h-3 text-white" />}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Set as default address
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Used automatically at checkout
          </p>
        </div>
      </label>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" fullWidth onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button fullWidth loading={saving} type="submit" icon={Check}>
          {defaultValues ? 'Update Address' : 'Add Address'}
        </Button>
      </div>
    </form>
  );
};

// ── Address card ──────────────────────────────────────────────────────────────
const AddressCard = ({ address, onEdit, onDelete, onSetDefault, settingDefault }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.97 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.97, height: 0 }}
    className={`card p-5 transition-all duration-200 ${
      address.isDefault
        ? 'border-primary-200 dark:border-primary-800/50 bg-primary-50/30 dark:bg-primary-900/10'
        : ''
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          address.isDefault
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        }`}>
          <LabelIcon label={address.label} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-slate-900 dark:text-white text-sm">
              {address.label}
            </span>
            {address.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium">
                <Star className="w-3 h-3 fill-current" />
                Default
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ''}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {address.city}, {address.state} — {address.pincode}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">{address.country}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onEdit(address)}
          className="p-2 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
          title="Edit"
        >
          <Pencil className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onDelete(address._id)}
          className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      </div>
    </div>

    {/* Set as default button */}
    {!address.isDefault && (
      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
        <button
          onClick={() => onSetDefault(address._id)}
          disabled={settingDefault}
          className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1.5 disabled:opacity-50"
        >
          <Star className="w-3.5 h-3.5" />
          Set as default address
        </button>
      </div>
    )}
  </motion.div>
);

// ── Main Addresses page ───────────────────────────────────────────────────────
export default function Addresses() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState({ open: false, editing: null });
  const [deletingId, setDeletingId] = useState(null);
  const [settingDefaultId, setSettingDefaultId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: usersApi.getAddresses,
  });

  const addresses = data?.data?.data?.addresses || [];

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['addresses'] });

  // ── Add ───────────────────────────────────────────────────────────────────
  const { mutate: addAddress, isPending: adding } = useMutation({
    mutationFn: usersApi.addAddress,
    onSuccess: () => {
      refetch();
      setModal({ open: false, editing: null });
      toast.success('Address added!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to add address');
    },
  });

  // ── Update ────────────────────────────────────────────────────────────────
  const { mutate: updateAddress, isPending: updating } = useMutation({
    mutationFn: ({ id, data }) => usersApi.updateAddress(id, data),
    onSuccess: () => {
      refetch();
      setModal({ open: false, editing: null });
      toast.success('Address updated!');
    },
    onError: () => toast.error('Failed to update address'),
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const { mutate: deleteAddress } = useMutation({
    mutationFn: (id) => usersApi.deleteAddress(id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: () => {
      refetch();
      toast.success('Address removed');
    },
    onError: () => toast.error('Failed to delete address'),
    onSettled: () => setDeletingId(null),
  });

  // ── Set default ───────────────────────────────────────────────────────────
  const { mutate: setDefault } = useMutation({
    mutationFn: (id) => usersApi.setDefaultAddress(id),
    onMutate: (id) => setSettingDefaultId(id),
    onSuccess: () => {
      refetch();
      toast.success('Default address updated!');
    },
    onError: () => toast.error('Failed to set default'),
    onSettled: () => setSettingDefaultId(null),
  });

  const handleSubmit = (data) => {
    if (modal.editing) {
      updateAddress({ id: modal.editing._id, data });
    } else {
      addAddress(data);
    }
  };

  const canAddMore = addresses.length < 5;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Addresses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {addresses.length}/5 addresses saved
          </p>
        </div>
        {canAddMore && (
          <Button
            icon={Plus}
            onClick={() => setModal({ open: true, editing: null })}
          >
            Add Address
          </Button>
        )}
      </motion.div>

      {/* Max addresses warning */}
      {!canAddMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 text-sm text-orange-700 dark:text-orange-400"
        >
          <MapPin className="w-4 h-4 flex-shrink-0" />
          Maximum 5 addresses reached. Remove one to add another.
        </motion.div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="shimmer h-36 rounded-2xl" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No addresses yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Add a delivery address for faster checkout
          </p>
          <Button
            icon={Plus}
            onClick={() => setModal({ open: true, editing: null })}
          >
            Add First Address
          </Button>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {addresses.map((addr) => (
              <AddressCard
                key={addr._id}
                address={addr}
                onEdit={(a) => setModal({ open: true, editing: a })}
                onDelete={deleteAddress}
                onSetDefault={setDefault}
                settingDefault={settingDefaultId === addr._id}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Add / Edit modal */}
      <Modal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing ? 'Edit Address' : 'Add New Address'}
        size="lg"
      >
        <AddressForm
          defaultValues={modal.editing}
          onSubmit={handleSubmit}
          onCancel={() => setModal({ open: false, editing: null })}
          saving={adding || updating}
        />
      </Modal>
    </div>
  );
}