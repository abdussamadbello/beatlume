"""S3-compatible object storage client (works with MinIO and AWS S3)."""

from __future__ import annotations

import boto3

from app.config import settings


class S3Storage:
    """Thin wrapper around boto3 S3 client.

    Uses two clients when a public endpoint is configured: the internal client for
    server-side I/O (uploads, deletes) and a public client whose presigned URLs are
    rooted at a host-reachable URL. This avoids the classic Docker/MinIO problem
    where the worker hands back http://minio:9000/... that the user's browser
    cannot resolve.
    """

    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
        )
        public_endpoint = settings.s3_public_endpoint_url or settings.s3_endpoint_url
        if public_endpoint == settings.s3_endpoint_url:
            self.public_client = self.client
        else:
            self.public_client = boto3.client(
                "s3",
                endpoint_url=public_endpoint,
                aws_access_key_id=settings.s3_access_key,
                aws_secret_access_key=settings.s3_secret_key,
            )

    def upload(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        """Upload bytes to S3."""
        self.client.put_object(
            Bucket=bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    def get_presigned_url(self, bucket: str, key: str, expiry: int = 3600) -> str:
        """Generate a presigned download URL.

        Uses the public client so the URL host is one the user's browser can resolve.
        """
        return self.public_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expiry,
        )

    def delete(self, bucket: str, key: str) -> None:
        """Delete an object from S3."""
        self.client.delete_object(Bucket=bucket, Key=key)
