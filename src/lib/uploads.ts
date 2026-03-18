import { isAuthed } from "@/lib/auth";

export type UploadKind = "avatar" | "cover" | "post";

function getToken() {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
}

export async function uploadToR2(file: File, kind: UploadKind): Promise<string> {
  if (!isAuthed()) throw new Error("Not signed in");
  const token = getToken();

  const contentType = (file.type || "application/octet-stream").toLowerCase();
  let presignRes: Response;
  try {
    presignRes = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kind, contentType, filename: file.name }),
    });
  } catch (e) {
    throw new Error(
      "Upload initialization failed (cannot reach /api/upload). Ensure your backend server is running."
    );
  }

  const presignText = await presignRes.text();
  let presign: { key: string; uploadUrl: string; publicUrl: string } | { error: string; details?: string };
  try {
    presign = JSON.parse(presignText);
  } catch {
    throw new Error(`Upload initialization failed (invalid JSON): ${presignText.slice(0, 200)}`);
  }
  if (!presignRes.ok || "error" in presign) {
    throw new Error(
      `Upload initialization failed (${presignRes.status}). ${"error" in presign ? presign.error : "Unknown error"}`
    );
  }

  try {
    const putRes = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`Cloud storage rejected the file (Status ${putRes.status}). Ensure your R2/S3 bucket CORS settings allow PUT for this origin.`);
    }
  } catch (err) {
    // In browsers this is commonly a CORS block from R2.
    console.error("R2 Upload Error:", err);
    throw new Error(
      "Upload failed while sending file to storage. This is most likely an R2 CORS issue. Please check your browser console (F12) for details and ensure your R2 bucket allows PUT and 'Content-Type' header from your website origin."
    );
  }

  return (presign as any).publicUrl;
}

