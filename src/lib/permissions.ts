/**
 * Cross-platform permission layer.
 *
 * On a Capacitor Android build (Target SDK 34/35) this delegates to the
 * native Camera plugin which raises the runtime dialogs for:
 *   - android.permission.CAMERA
 *   - android.permission.READ_MEDIA_IMAGES   (Android 13+ / SDK 33+)
 *   - android.permission.READ_MEDIA_VISUAL_USER_SELECTED (Android 14+ partial access)
 *   - android.permission.READ_EXTERNAL_STORAGE (only on Android <= 12 / SDK <= 32)
 *
 * On the web (and inside Lovable's preview) it falls back to navigator
 * Permissions API + getUserMedia, so the same call sites work everywhere.
 */

import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export type PermissionState = "granted" | "denied" | "prompt" | "limited" | "unknown";

export interface CombinedPermissionStatus {
  camera: PermissionState;
  photos: PermissionState;
}

const isNative = () => Capacitor.isNativePlatform();

/** Read current permission state without prompting. */
export async function checkPermissions(): Promise<CombinedPermissionStatus> {
  if (isNative()) {
    try {
      const status = await Camera.checkPermissions();
      return {
        camera: (status.camera as PermissionState) ?? "unknown",
        photos: (status.photos as PermissionState) ?? "unknown",
      };
    } catch (error) {
      console.error("Camera permission check failed", error);
      return { camera: "unknown", photos: "unknown" };
    }
  }

  // Web fallback
  const out: CombinedPermissionStatus = { camera: "unknown", photos: "prompt" };
  if (typeof navigator !== "undefined" && "permissions" in navigator) {
    try {
      const cam = await navigator.permissions.query({ name: "camera" as PermissionName });
      out.camera = cam.state as PermissionState;
    } catch {
      out.camera = "prompt";
    }
  }
  return out;
}

/**
 * Request runtime permissions. Pass the kinds you actually need so we don't
 * over-ask (Google Play policy requires least-privilege).
 */
export async function requestPermissions(
  kinds: Array<"camera" | "photos"> = ["camera"],
): Promise<CombinedPermissionStatus> {
  if (isNative()) {
    try {
      const status = await Camera.requestPermissions({ permissions: kinds });
      return {
        camera: (status.camera as PermissionState) ?? "unknown",
        photos: (status.photos as PermissionState) ?? "unknown",
      };
    } catch (error) {
      console.error("Camera permission request failed", error);
      return { camera: "denied", photos: "denied" };
    }
  }

  // Web: requesting "camera" via getUserMedia triggers the native browser prompt.
  const out: CombinedPermissionStatus = { camera: "unknown", photos: "granted" };
  if (kinds.includes("camera") && typeof navigator !== "undefined") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((t) => t.stop());
      out.camera = "granted";
    } catch {
      out.camera = "denied";
    }
  }
  return out;
}

async function captureImage(source: CameraSource): Promise<string | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source,
    });
    return image.webPath ?? image.path ?? null;
  } catch (error) {
    console.error("Camera action failed", error);
    return null;
  }
}

/** Capture a still image with the native camera overlay. Returns a WebView-safe URI or null. */
export async function captureImageWithCamera(): Promise<string | null> {
  if (isNative()) return captureImage(CameraSource.Camera);
  return null;
}

/** Pick an image from the device gallery. Returns a WebView-safe URI/data URL or null. */
export async function pickImageFromGallery(): Promise<string | null> {
  if (isNative()) {
    // On Android 14+ the system shows the "Selected photos" picker automatically
    // when the app holds READ_MEDIA_VISUAL_USER_SELECTED.
    return captureImage(CameraSource.Photos);
  }

  // Web fallback: <input type="file"> picker
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/**
 * Save a downloaded font file to public Documents on Android (no
 * WRITE_EXTERNAL_STORAGE needed on SDK 30+ thanks to scoped storage),
 * or trigger a browser download on the web.
 */
export async function saveFontFile(fileName: string, blob: Blob): Promise<boolean> {
  if (isNative()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({
        path: `TRIVO/${fileName}`,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      return true;
    } catch {
      return false;
    }
  }
  // Web: standard download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export const platform = {
  isNative,
  name: () => Capacitor.getPlatform(),
};
