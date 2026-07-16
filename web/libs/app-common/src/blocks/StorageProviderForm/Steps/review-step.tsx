interface ReviewStepProps {
  formData: any;
  filesPreview?: any;
  formatSize?: (bytes: number) => string;
}

export const ReviewStep = ({ formData, filesPreview, formatSize }: ReviewStepProps) => {
  const getProviderDisplayName = (provider: string) => {
    const providerMap: Record<string, string> = {
      s3: "Amazon S3",
      gcp: "Google Cloud Storage",
      azure: "Azure Blob Storage",
      redis: "Redis",
      localfiles: "本地文件",
    };
    return providerMap[provider] || provider;
  };

  const getBucketName = () => {
    return formData.bucket || formData.container || "未指定";
  };

  const getFileCount = () => {
    if (!filesPreview) return "0 个文件";

    // Check if the last file is the "preview limit reached" indicator
    const lastFile = filesPreview[filesPreview.length - 1];
    const hasMoreFiles = lastFile && lastFile.key === null;

    if (hasMoreFiles) {
      // Subtract 1 to exclude the placeholder file
      const visibleFileCount = filesPreview.length - 1;
      return `超过 ${visibleFileCount} 个文件`;
    }

    return `${filesPreview.length} 个文件`;
  };

  const getTotalSize = () => {
    if (!filesPreview || !formatSize) return "0 字节";

    // Check if the last file is the "preview limit reached" indicator
    const lastFile = filesPreview[filesPreview.length - 1];
    const hasMoreFiles = lastFile && lastFile.key === null;

    // Calculate total size excluding the placeholder file if it exists
    const filesToCount = hasMoreFiles ? filesPreview.slice(0, -1) : filesPreview;
    const totalBytes = filesToCount.reduce((sum: number, file: any) => sum + (file.size || 0), 0);

    if (hasMoreFiles) {
      return `超过 ${formatSize(totalBytes)}`;
    }

    return formatSize(totalBytes);
  };

  return (
    <div>
      <div className="border-b pb-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">准备连接</h2>
        <p className="text-gray-600 mt-1">查看你的连接详情并确认开始导入</p>
      </div>

      {/* Connection Details Section */}
      <div className="grid grid-cols-2 gap-y-4 mb-8">
        <div>
          <p className="text-sm text-gray-500">提供商</p>
          <p className="font-medium">{getProviderDisplayName(formData.provider)}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">存储位置</p>
          <p className="font-medium">{getBucketName()}</p>
        </div>

        {formData.prefix && (
          <div>
            <p className="text-sm text-gray-500">前缀</p>
            <p className="font-medium">{formData.prefix}</p>
          </div>
        )}

        {filesPreview && (
          <>
            <div>
              <p className="text-sm text-gray-500">待导入文件</p>
              <p className="font-medium">{getFileCount()}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">总大小</p>
              <p className="font-medium">{getTotalSize()}</p>
            </div>
          </>
        )}
      </div>

      {/* Import Process Section */}
      <div className="bg-primary-background border border-primary-border-subtler rounded-small p-4 mb-8">
        <h3 className="text-lg font-semibold mb-2">导入流程</h3>
        <p>文件将在后台导入。你可以继续工作，导入会在后台进行。</p>
      </div>
    </div>
  );
};
