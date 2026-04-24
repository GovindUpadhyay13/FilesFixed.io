  export async function computeSHA256(data) {
    const buffer = data instanceof ArrayBuffer ? data : data.buffer;

    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

    const hashArray = new Uint8Array(hashBuffer);
    const hexString = Array.from(hashArray)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    return hexString;
  }

  export async function verifySHA256(data, expectedHash) {
    const computed = await computeSHA256(data);

    return {
      match: computed === expectedHash,
      computed,
      expected: expectedHash
    };
  }
