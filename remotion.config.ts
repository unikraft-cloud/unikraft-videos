import { Config } from '@remotion/cli/config';

Config.setEntryPoint('videos/index.ts');

// High-quality intermediate frames: the style is flat colour + fine hairlines,
// which JPEG smears at default quality.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);

Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setOverwriteOutput(true);
