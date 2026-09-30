import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationPicker } from "@/components/dydlye/LocationPicker";
import { useSettings } from "@/i18n/useTranslation";
import {
  commonFeatures,
  defaultPropertyValues,
  propertyTypes,
  type PropertyFormValues,
  type PropertySubmitData,
} from "./types";
import { uploadPropertyImages } from "./uploadImages";

const MAX_IMAGES = 5;
const MIN_IMAGES = 3;

interface PropertyFormProps {
  heading: string;
  userId: string;
  initialValues?: Partial<PropertyFormValues>;
  existingImages?: string[];
  submitLabel: string;
  savingLabel: string;
  onSubmit: (data: PropertySubmitData) => Promise<void>;
}

export function PropertyForm({
  heading,
  userId,
  initialValues,
  existingImages: initialExistingImages = [],
  submitLabel,
  savingLabel,
  onSubmit,
}: PropertyFormProps) {
  const { t, currency } = useSettings();
  const [formData, setFormData] = useState<PropertyFormValues>({
    ...defaultPropertyValues,
    ...initialValues,
  });
  const [existingImages, setExistingImages] = useState<string[]>(initialExistingImages);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState("");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const totalImages = existingImages.length + selectedFiles.length;

  const updateField = <K extends keyof PropertyFormValues>(
    key: K,
    value: PropertyFormValues[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const addCustomFeature = () => {
    if (customFeature.trim() && !formData.features.includes(customFeature.trim())) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, customFeature.trim()],
      }));
      setCustomFeature("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newTotal = totalImages + files.length;

    if (newTotal > MAX_IMAGES) {
      toast.error(t("add.maxImages"));
      const remainingSlots = MAX_IMAGES - totalImages;
      if (remainingSlots <= 0) return;
      addFiles(files.slice(0, remainingSlots));
    } else {
      addFiles(files);
    }
  };

  const addFiles = (files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return url;
    });
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleNext = () => {
    if (!formData.title.trim()) {
      toast.error(t("add.required.title"));
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error(t("add.required.price"));
      return;
    }
    if (!formData.phone.trim()) {
      toast.error(t("add.required.phone"));
      return;
    }
    if (totalImages < MIN_IMAGES) {
      toast.error(t("add.required.images", String(totalImages)));
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 2) return;

    if (!formData.lat || !formData.lng) {
      toast.error(t("add.locationRequired"));
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast.error(t("add.priceInvalid"));
      return;
    }

    setSaving(true);
    try {
      let newImageUrls: string[] = [];
      if (selectedFiles.length > 0) {
        toast.info(t("add.compressing"));
        newImageUrls = await uploadPropertyImages(selectedFiles, userId);
      }
      await onSubmit({
        values: formData,
        images: [...existingImages, ...newImageUrls],
      });
    } catch (err) {
      console.error("Error submitting property form:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-foreground">{heading}</h1>
        <div className="text-sm font-medium text-muted-foreground">
          {t("add.step", String(step))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 1 ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                {t("add.label.title")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder={t("add.placeholder.title")}
                value={formData.title}
                onChange={(e) => updateField("title", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">
                  {t("add.label.type")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => updateField("type", v as PropertyFormValues["type"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("add.placeholder.type")} />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">
                  {t("add.label.price")} ({currency}/{t("card.month")}){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => updateField("price", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("add.label.description")}</Label>
              <Textarea
                id="description"
                placeholder={t("add.placeholder.description")}
                className="min-h-[120px]"
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                {t("add.label.phone")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t("add.placeholder.phone")}
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>
                {t("add.label.images")} <span className="text-destructive">*</span>{" "}
                <span
                  className={`text-xs ${totalImages < MIN_IMAGES ? "text-destructive" : "text-green-600"}`}
                >
                  ({totalImages}/{MIN_IMAGES})
                </span>
              </Label>
              <div className="grid grid-cols-3 gap-4">
                {existingImages.map((url, idx) => (
                  <div
                    key={`existing-${idx}`}
                    className="relative aspect-square overflow-hidden rounded-xl border bg-muted"
                  >
                    <img
                      src={url}
                      alt="Property"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(idx)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}

                {previews.map((preview, index) => (
                  <div
                    key={`new-${index}`}
                    className="relative aspect-square overflow-hidden rounded-xl border bg-muted"
                  >
                    <img
                      src={preview}
                      alt="Preview"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}

                {totalImages < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 transition hover:border-primary/50 hover:bg-primary/5"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <span className="mt-2 text-xs text-muted-foreground">
                      {t("add.addFeature")}
                    </span>
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-3">
              <Label>{t("add.label.features")}</Label>
              <div className="flex flex-wrap gap-2">
                {commonFeatures.map((feature) => (
                  <button
                    key={feature}
                    type="button"
                    onClick={() => toggleFeature(feature)}
                    className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                      formData.features.includes(feature)
                        ? "bg-primary text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {feature}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Input
                  placeholder={t("add.placeholder.feature")}
                  value={customFeature}
                  onChange={(e) => setCustomFeature(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCustomFeature())}
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCustomFeature}
                  className="h-9 px-3 text-xs"
                >
                  {t("add.add")}
                </Button>
              </div>

              {formData.features.filter((f) => !commonFeatures.includes(f as never)).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.features
                    .filter((f) => !commonFeatures.includes(f as never))
                    .map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                      >
                        {feature}
                        <button
                          type="button"
                          onClick={() => toggleFeature(feature)}
                          className="ml-1 hover:text-primary/70"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <Button type="button" onClick={handleNext} className="w-full">
              {t("add.next")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2">
              <Label>{t("add.label.location")}</Label>
              <LocationPicker
                initialLat={formData.lat ?? undefined}
                initialLng={formData.lng ?? undefined}
                onLocationSelect={(lat, lng, address, city) =>
                  setFormData((prev) => ({
                    ...prev,
                    lat,
                    lng,
                    location: address,
                    city: city ?? prev.city,
                  }))
                }
              />
              {formData.location && (
                <p className="text-sm font-medium text-primary">{formData.location}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">{t("add.label.city")}</Label>
              <Input
                id="city"
                placeholder={t("add.placeholder.city")}
                value={formData.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="area">{t("add.label.area")}</Label>
                <Input
                  id="area"
                  type="number"
                  value={formData.area}
                  onChange={(e) => updateField("area", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bedrooms">{t("add.label.bedrooms")}</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  value={formData.bedrooms}
                  onChange={(e) => updateField("bedrooms", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">{t("add.label.bathrooms")}</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  value={formData.bathrooms}
                  onChange={(e) => updateField("bathrooms", e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                {t("add.back")}
              </Button>
              <Button type="submit" disabled={saving} className="flex-[2]">
                {saving ? savingLabel : submitLabel}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
