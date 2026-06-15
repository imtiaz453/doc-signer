import { createUploadthing } from 'uploadthing/next';

const f = createUploadthing();

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 10 } })
    .onUploadComplete(async ({ file }) => {
      console.log('Upload complete:', file.ufsUrl, file.name);
    }),
};
