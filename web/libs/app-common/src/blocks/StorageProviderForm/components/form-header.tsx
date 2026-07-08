import { Button } from "@humansignal/ui";
import { IconCross } from "@humansignal/icons";

interface FormHeaderProps {
  title?: string;
  onClose: () => void;
}

export const FormHeader = ({ title, onClose }: FormHeaderProps) => {
  return (
    <div className="flex justify-between items-start px-wide py-base pt-wide">
      <div>
        <h2 className="m-0 mb-tight text-headline-large font-medium text-neutral-content">{title}</h2>
        <div className="text-body-medium text-neutral-content-subtle leading-relaxed">
          从云存储提供商导入你的数据
        </div>
      </div>
      <Button leading={<IconCross />} look="string" onClick={onClose} />
    </div>
  );
};
