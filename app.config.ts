import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const basePath = process.env.AM_APP_WEB_BASE_PATH;
  return {
    ...config,
    name: config.name ?? 'AM Investments app',
    slug: config.slug ?? 'am-investments',
    ...(basePath ? { experiments: { ...config.experiments, baseUrl: basePath } } : {}),
  };
};
