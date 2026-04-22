import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Trash2, Check, User,
  Mail, Shield, Eye, EyeOff,
  Loader2, AlertCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { usersApi } from '../../api/users.api';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { formatDate } from '../../utils/format';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z
      .string()
      .min(8, 'Minimum 8 characters')
      .regex(/[A-Z]/, 'Must have uppercase')
      .regex(/[a-z]/, 'Must have lowercase')
      .regex(/[0-9]/, 'Must have number')
      .regex(/[@$!%*?&]/, 'Must have special char'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export default function Profile() {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  // ── Profile form ──────────────────────────────────────────────────────────
  const {
    register: profileReg,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '' },
  });

  // ── Password form ─────────────────────────────────────────────────────────
  const {
    register: pwdReg,
    handleSubmit: handlePwdSubmit,
    formState: { errors: pwdErrors },
    reset: resetPwdForm,
    setError: setPwdError,
  } = useForm({ resolver: zodResolver(passwordSchema) });

  // ── Avatar file selection ─────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPG, PNG, WebP allowed');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // ── Update name ───────────────────────────────────────────────────────────
  const { mutate: updateProfile, isPending: updatingProfile } = useMutation({
    mutationFn: usersApi.updateProfile,
    onSuccess: (res) => {
      const updated = res.data.data.user;
      updateUser({ name: updated.name });
      toast.success('Profile updated!');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  // ── Upload avatar ─────────────────────────────────────────────────────────
  const { mutate: uploadAvatar, isPending: uploadingAvatar } = useMutation({
    mutationFn: (formData) => usersApi.uploadAvatar(formData),
    onSuccess: (res) => {
      const avatarData = res.data.data.avatar;
      updateUser({ avatar: avatarData });
      setAvatarPreview(null);
      setAvatarFile(null);
      toast.success('Avatar updated!');
    },
    onError: () => toast.error('Failed to upload avatar'),
  });

  // ── Delete avatar ─────────────────────────────────────────────────────────
  const { mutate: deleteAvatar, isPending: deletingAvatar } = useMutation({
    mutationFn: usersApi.deleteAvatar,
    onSuccess: () => {
      updateUser({ avatar: null });
      toast.success('Avatar removed');
    },
    onError: () => toast.error('Failed to remove avatar'),
  });

  // ── Change password ───────────────────────────────────────────────────────
  const { mutate: changePassword, isPending: changingPwd } = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      setPwdSuccess(true);
      resetPwdForm();
      setTimeout(() => setPwdSuccess(false), 4000);
      toast.success('Password changed!');
    },
    onError: (err) => {
      const msg = err.response?.data?.message;
      if (msg?.includes('Current')) {
        setPwdError('currentPassword', { message: msg });
      } else {
        toast.error(msg || 'Failed to change password');
      }
    },
  });

  const handleAvatarUpload = () => {
    if (!avatarFile) return;
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    uploadAvatar(formData);
  };

  const currentAvatar = avatarPreview || user?.avatar?.url;

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your account information
        </p>
      </motion.div>

      {/* ── Avatar section ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-6"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary-600" />
          Profile Photo
        </h2>

        <div className="flex items-start gap-6">
          {/* Avatar display */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center">
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {user?.name?.[0]?.toUpperCase()}
                </span>
              )}
            </div>

            {/* Preview badge */}
            {avatarPreview && (
              <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-primary-600 text-white text-[10px] font-bold">
                Preview
              </div>
            )}
          </div>

          {/* Upload controls */}
          <div className="flex-1">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              JPG, PNG or WebP. Max 2MB.
            </p>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />

              <Button
                variant="outline"
                size="sm"
                icon={Camera}
                onClick={() => fileInputRef.current?.click()}
              >
                {currentAvatar ? 'Change Photo' : 'Upload Photo'}
              </Button>

              {avatarPreview && (
                <Button
                  size="sm"
                  loading={uploadingAvatar}
                  onClick={handleAvatarUpload}
                  icon={Check}
                >
                  Save Photo
                </Button>
              )}

              {user?.avatar?.url && !avatarPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  loading={deletingAvatar}
                  onClick={() => deleteAvatar()}
                  className="!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20"
                >
                  Remove
                </Button>
              )}

              {avatarPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    setAvatarPreview(null);
                    setAvatarFile(null);
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Profile info ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card p-6"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-primary-600" />
          Personal Information
        </h2>

        <form
          onSubmit={handleProfileSubmit((data) => updateProfile(data))}
          className="space-y-4"
        >
          <Input
            label="Full Name"
            placeholder="John Doe"
            error={profileErrors.name?.message}
            {...profileReg('name')}
          />

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              Email Address
            </label>
            <div className="flex items-center gap-2">
              <input
                value={user?.email || ''}
                readOnly
                className="input-base bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed opacity-75 flex-1"
              />
              <span className="px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium whitespace-nowrap">
                Verified
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Email cannot be changed
            </p>
          </div>

          {/* Role */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <Shield className="w-4 h-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Account Type</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                {user?.role}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={updatingProfile}
              disabled={!isDirty}
              icon={Check}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </motion.div>

      {/* ── Change password ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card p-6"
      >
        <h2 className="font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary-600" />
          Change Password
        </h2>

        <AnimatePresence mode="wait">
          {pwdSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30"
            >
              <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  Password changed successfully
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  You may need to log in again on other devices
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handlePwdSubmit((data) => changePassword(data))}
              className="space-y-4"
            >
              {/* Current password */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`input-base pr-10 ${pwdErrors.currentPassword ? 'border-red-400' : ''}`}
                    {...pwdReg('currentPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwdErrors.currentPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {pwdErrors.currentPassword.message}
                  </p>
                )}
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPwd ? 'text' : 'password'}
                    placeholder="New strong password"
                    className={`input-base pr-10 ${pwdErrors.newPassword ? 'border-red-400' : ''}`}
                    {...pwdReg('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd(!showNewPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {pwdErrors.newPassword && (
                  <p className="text-xs text-red-500">{pwdErrors.newPassword.message}</p>
                )}
              </div>

              {/* Confirm password */}
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Repeat new password"
                error={pwdErrors.confirmPassword?.message}
                {...pwdReg('confirmPassword')}
              />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={changingPwd}
                  icon={Shield}
                >
                  Update Password
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}