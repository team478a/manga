"use server";

/**
 * Compatibility entrypoint for existing Server Action imports.
 * New actions live in feature modules under `src/app/actions`.
 */
import {
  requestPasswordReset as requestPasswordResetAction,
  signIn as signInAction,
  signOut as signOutAction,
  signUp as signUpAction,
  updatePassword as updatePasswordAction,
} from "./actions/auth-actions";
import { createPendingOrder as createPendingOrderAction } from "./actions/checkout-actions";
import {
  createGoodsRequest as createGoodsRequestAction,
  updateGoodsRequestAdmin as updateGoodsRequestAdminAction,
} from "./actions/goods-request-actions";
import {
  createDigitalProduct as createDigitalProductAction,
  updateDigitalProduct as updateDigitalProductAction,
} from "./actions/product-actions";
import { updateProfile as updateProfileAction } from "./actions/profile-actions";
import {
  createWork as createWorkAction,
  selectWorkPublication as selectWorkPublicationAction,
  updateWork as updateWorkAction,
} from "./actions/work-actions";

export async function signUp(formData: FormData) {
  return signUpAction(formData);
}

export async function signIn(formData: FormData) {
  return signInAction(formData);
}

export async function requestPasswordReset(formData: FormData) {
  return requestPasswordResetAction(formData);
}

export async function updatePassword(formData: FormData) {
  return updatePasswordAction(formData);
}

export async function signOut() {
  return signOutAction();
}

export async function updateProfile(formData: FormData) {
  return updateProfileAction(formData);
}

export async function createWork(formData: FormData) {
  return createWorkAction(formData);
}

export async function updateWork(formData: FormData) {
  return updateWorkAction(formData);
}

export async function selectWorkPublication(formData: FormData) {
  return selectWorkPublicationAction(formData);
}

export async function createDigitalProduct(formData: FormData) {
  return createDigitalProductAction(formData);
}

export async function updateDigitalProduct(formData: FormData) {
  return updateDigitalProductAction(formData);
}

export async function createGoodsRequest(formData: FormData) {
  return createGoodsRequestAction(formData);
}

export async function updateGoodsRequestAdmin(formData: FormData) {
  return updateGoodsRequestAdminAction(formData);
}

export async function createPendingOrder(formData: FormData) {
  return createPendingOrderAction(formData);
}
