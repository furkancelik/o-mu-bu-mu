import { NextRequest, NextResponse } from "next/server";
import { getCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { getAdminFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_REQUEST = 30;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type UploadedImage = {
  url: string;
  fileName: string;
  width: number;
  height: number;
};

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminFromRequest(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Resim depolama servisi yapılandırılmamış" },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();
    const files = form.getAll("files");
    if (files.length === 0) {
      return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Tek seferde en fazla ${MAX_FILES_PER_REQUEST} dosya` },
        { status: 400 }
      );
    }

    const cloudinary = getCloudinary();
    const out: UploadedImage[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      if (!ALLOWED.has(file.type)) {
        return NextResponse.json(
          { error: `Desteklenmeyen tip: ${file.type}` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `Dosya çok büyük: ${file.name}` },
          { status: 400 }
        );
      }

      const buf = Buffer.from(await file.arrayBuffer());
      const dataUri = `data:${file.type};base64,${buf.toString("base64")}`;

      const res = await cloudinary.uploader.upload(dataUri, {
        folder: "omubumu",
        resource_type: "image",
        transformation: [
          {
            width: 1600,
            height: 1600,
            crop: "limit",
            quality: "auto:good",
            fetch_format: "auto",
          },
        ],
      });

      out.push({
        url: res.secure_url,
        fileName: file.name,
        width: res.width,
        height: res.height,
      });
    }

    return NextResponse.json({ images: out });
  } catch (err) {
    console.error("upload error", err);
    return NextResponse.json(
      { error: "Yükleme sırasında bir hata oluştu" },
      { status: 500 }
    );
  }
}
