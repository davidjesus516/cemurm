
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlogContext } from "src/context/blog-context";
import { useContext } from "react";
import { Label } from "@/components/ui/label";
import { CloudUpload } from "lucide-react";
import { Input } from "@/components/ui/input";

const Media = () => {
  const { posts } = useContext(BlogContext);
  const coverImage = posts.length > 0 ? posts[0].coverImg : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h5>Cover Image</h5>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex w-full items-center justify-center mb-4">
            <Label
              htmlFor="dropzone-file"
              className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-cem-amber bg-cem-amber/5"
            >
              {coverImage ? (
                <img
                  src={coverImage}
                  alt="Cover"
                  className="h-full w-full object-cover rounded-lg "
                />
              ) : (
                <div className="flex flex-col items-center justify-center pb-6 pt-5">
                  <CloudUpload size={32} className="mb-3 text-cem-amber" />
                  <p className="mb-2 text-sm text-cem-amber ">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-cem-amber ">
                    SVG, PNG, JPG or GIF (MAX. 800x400px)
                  </p>
                </div>
              )}
              <Input type="file" id="dropzone-file" className="hidden" />
            </Label>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default Media;
