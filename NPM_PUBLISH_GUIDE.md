# Hướng dẫn Publish lên NPM

Package `galaxy-ui-cli` đã được chuẩn bị đầy đủ để publish lên npm registry. Làm theo các bước sau:

## Bước 1: Đăng nhập NPM

```bash
npm login
```

Bạn sẽ được yêu cầu nhập:
- Username
- Password
- Email
- OTP (nếu bật 2FA)

## Bước 2: Kiểm tra package trước khi publish

```bash
# Kiểm tra files sẽ được publish
npm pack --dry-run

# Xem chi tiết package info
npm publish --dry-run
```

## Bước 3: Publish package

```bash
npm publish
```

Package sẽ tự động build (qua `prepublishOnly` script) trước khi publish.

## Bước 4: Verify

Sau khi publish thành công:

```bash
# Kiểm tra package đã có trên npm
npm view galaxy-ui-cli

# Test cài đặt global
npm install -g galaxy-ui-cli

# Hoặc chạy trực tiếp với npx
npx galaxy-ui-cli@latest --version
```

## Cập nhật version sau này

Khi cần publish version mới:

```bash
# Tăng patch version (0.1.0 -> 0.1.1)
npm version patch

# Tăng minor version (0.1.0 -> 0.2.0)
npm version minor

# Tăng major version (0.1.0 -> 1.0.0)
npm version major

# Sau đó publish
npm publish
```

## Thông tin package

- **Name**: `galaxy-ui-cli`
- **Version**: `0.1.0`
- **Homepage**: https://galaxy-ui-docs.vercel.app
- **Repository**: https://github.com/buikevin/galaxy-ui-cli
- **License**: MIT

## Lưu ý

1. Tên package `galaxy-ui-cli` đã được kiểm tra và có sẵn trên npm
2. Package được config với `"private": false` nên có thể publish công khai
3. `prepublishOnly` script sẽ tự động build trước khi publish
4. `.npmignore` đã loại bỏ source files, chỉ publish compiled code

## Troubleshooting

### Lỗi 403 Forbidden
- Kiểm tra bạn đã login: `npm whoami`
- Kiểm tra quyền access với scope (nếu dùng scoped package)

### Lỗi 404 Package not found
- Package name chưa tồn tại, có thể publish
- Kiểm tra typo trong package name

### Lỗi Version already exists
- Version này đã được publish
- Cần tăng version: `npm version patch/minor/major`

## Next Steps

Sau khi publish thành công:
1. Update documentation với instruction cài đặt: `npx galaxy-ui-cli@latest`
2. Tạo GitHub release
3. Update CHANGELOG.md
4. Share package link: https://www.npmjs.com/package/galaxy-ui-cli
