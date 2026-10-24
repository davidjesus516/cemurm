
import { useState } from "react";

import { Label } from "@/components/ui/label";

import { X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";
import { demoBlogCategories, demoBlogTags } from "@/demo/content";

const CategoryTags = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");

  const [Cats, setCats] = useState<string[]>([]);
  const [showCatOptions, setShowCatOptions] = useState<boolean>(false);
  const [catOptions] = useState<string[]>(demoBlogCategories);

  const [showTagOptions, setShowTagOptions] = useState<boolean>(false);
  const [tagOptions] = useState<string[]>(demoBlogTags);

  const handleCatInputChange = () => {
    setShowCatOptions(true);
  };

  const handleCatInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && Cats.length > 0) {
      setCats([]);
      setShowCatOptions(false);
    }
  };

  const handleCatClick = (option: string) => {
    if (!Cats.includes(option)) {
      setCats([...Cats, option]);
    }
    setShowCatOptions(false);
  };

  const handleCatDelete = (catToDelete: string) => {
    const updatedCats = Cats.filter((cat) => cat !== catToDelete);
    setCats(updatedCats);
  };

  const handleTagInputChange = () => {
    setShowTagOptions(true);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleTagClick = (option: string) => {
    if (!tags.includes(option)) {
      setTags([...tags, option]);
    }
    setShowTagOptions(false);
  };

  const handleTagDelete = (tagToDelete: string) => {
    const updatedTags = tags.filter((tag) => tag !== tagToDelete);
    setTags(updatedTags);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h5>Blog Category</h5>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="">
          <div className="mb-2 block">
            <Label htmlFor="cat">
              Categories
              <span className="text-destructive">*</span>
            </Label>
          </div>

          <div className="relative">
            <div className="flex flex-wrap items-center gap-1 min-h-[40px] w-full rounded-md border border-cem-hover bg-cem-base px-2 py-1 focus-within:ring-1 focus-within:ring-cem-amber">
              {Cats.map((cat, index) => (
                <span
                  key={index}
                  className="flex items-center rounded-full bg-cem-amber/5 px-2 py-1 text-sm text-cem-amber"
                >
                  {cat}
                  <X
                    size={12}
                    className="ml-1 cursor-pointer"
                    onClick={() => handleCatDelete(cat)}
                  />
                </span>
              ))}

              <input
                type="text"
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                onFocus={handleCatInputChange}
                onKeyDown={handleCatInputKeyDown}
              />
            </div>

            <small className="text-xs text-cem-secondary-elevated">
              Add blog to a category.
            </small>

            {showCatOptions && (
              <div className="absolute z-10 mt-1 w-full rounded-md bg-cem-surface shadow-lg">
                {catOptions.map((option, index) => (
                  <div
                    key={index}
                    className="cursor-pointer px-3 py-2 hover:bg-cem-hover"
                    onClick={() => handleCatClick(option)}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 block">
            <Label htmlFor="tags">Tags</Label>
          </div>

          <div className="relative">
            <div className="flex flex-wrap items-center gap-1 min-h-[40px] w-full rounded-md border border-cem-hover bg-cem-base px-2 py-1 focus-within:ring-1 focus-within:ring-cem-amber">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className=" py-1 px-2 rounded-full text-cem-amber bg-cem-amber/5 flex items-center"
                >
                  {tag}
                  <X
                    onClick={() => handleTagDelete(tag)}
                    className="cursor-pointer ml-1"
                    size={12}
                  />
                </span>
              ))}

              <input
                type="text"
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                onFocus={handleTagInputChange}
                onKeyDown={handleTagInputKeyDown}
              />
            </div>

            <small className="text-xs text-cem-secondary-elevated">
              Add tags for blog.
            </small>

            {showTagOptions && (
              <div className="absolute z-10 mt-1 w-full rounded-md bg-cem-surface shadow-lg">
                {tagOptions.map((option, index) => (
                  <div
                    key={index}
                    className="cursor-pointer px-3 py-2 hover:bg-cem-hover"
                    onClick={() => handleTagClick(option)}
                  >
                    {option}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoryTags;
