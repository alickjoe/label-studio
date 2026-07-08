import { useState } from "react";
import { Button } from "@humansignal/ui";
import { ErrorWrapper } from "../../../components/Error/Error";
import { InlineError } from "../../../components/Error/InlineError";
import { Form, Input, Select, TextArea, Toggle } from "../../../components/Form";
import "./MachineLearningSettings.prefix.css";

const CustomBackendForm = ({ action, backend, project, onSubmit }) => {
  const [selectedAuthMethod, setAuthMethod] = useState("NONE");
  const [, setMLError] = useState();

  return (
    <Form
      action={action}
      formData={{ ...(backend ?? {}) }}
      params={{ pk: backend?.id }}
      onSubmit={async (response) => {
        if (!response.error_message) {
          onSubmit(response);
        }
      }}
    >
      <Input type="hidden" name="project" value={project.id} />

      <Form.Row columnCount={1}>
        <Input name="title" label="名称" placeholder="输入名称" required />
      </Form.Row>

      <Form.Row columnCount={1}>
        <Input name="url" label="后端 URL" required />
      </Form.Row>

      <Form.Row columnCount={2}>
        <Select
          name="auth_method"
          label="选择认证方式"
          options={[
            { label: "无认证", value: "NONE" },
            { label: "基本认证", value: "BASIC_AUTH" },
          ]}
          value={selectedAuthMethod}
          onChange={setAuthMethod}
        />
      </Form.Row>

      {(backend?.auth_method === "BASIC_AUTH" || selectedAuthMethod === "BASIC_AUTH") && (
        <Form.Row columnCount={2}>
          <Input name="basic_auth_user" label="基本认证用户名" />
          {backend?.basic_auth_pass_is_set ? (
            <Input name="basic_auth_pass" label="基本认证密码" type="password" placeholder="********" />
          ) : (
            <Input name="basic_auth_pass" label="基本认证密码" type="password" />
          )}
        </Form.Row>
      )}

      <Form.Row columnCount={1}>
        <TextArea
          name="extra_params"
          label="连接模型时要传递的额外参数"
          style={{ minHeight: 120 }}
        />
      </Form.Row>

      <Form.Row columnCount={1}>
        <Toggle
          name="is_interactive"
          label="交互式预标注"
          description="启用后，某些标注工具会在标注过程中向 ML 后端发送交互式请求。"
        />
      </Form.Row>

      <Form.Actions>
        <Button type="submit" look="primary" onClick={() => setMLError(null)} aria-label="保存机器学习表单">
          验证并保存
        </Button>
      </Form.Actions>

      <Form.ResponseParser>
        {(response) => (
          <>
            {response.error_message && (
              <ErrorWrapper
                error={{
                  response: {
                    detail: `${backend ? "保存" : "添加新"} ML 后端失败。`,
                    exc_info: response.error_message,
                  },
                }}
              />
            )}
          </>
        )}
      </Form.ResponseParser>

      <InlineError />
    </Form>
  );
};

export { CustomBackendForm };
