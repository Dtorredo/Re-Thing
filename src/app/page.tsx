import { ImageUploader } from "@/components/image-uploader";
import { GradientText } from "@/components/ui/gradient-text";
import Link from "next/link";

const page = () => {
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="w-full p-4 flex justify-between items-center">
        <Link 
          href="https://github.com/Dtorredo/Re-Thing" 
          target="_blank"
          className="text-sm text-white/80 hover:text-white transition-colors"
        >
          GitHub Repo
        </Link>
        <Link 
          href="https://portfolio-ivory-tau-48.vercel.app/" 
          target="_blank"
          className="text-sm text-white/80 hover:text-white transition-colors"
        >
          Someone said Derrick ? 
        </Link>
      </div>
      <div className="grid place-content-center gap-12 pt-16">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter">
            Peak Background Remover
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Easily remove the background from images. And, yes, Aryan has something to do with this.
          </p>
        </div>
        <ImageUploader />
      </div>
    </div>
  );
}

export default page;