const jwt = require("jsonwebtoken");
const { createRefreshTokenId, hashTokenId, parseDurationMs } = require("./helpers");

class TokenManager {
  constructor(accessSecret, refreshSecret, accessExpire, refreshExpire) {
    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
    this.accessExpire = accessExpire;
    this.refreshExpire = refreshExpire;
  }

  createAccessToken(user) {
    return jwt.sign({ sub: user._id.toString(), role: user.role }, this.accessSecret, {
      expiresIn: this.accessExpire,
    });
  }

  createRefreshToken(userId, tokenId) {
    return jwt.sign(
      { sub: userId, jti: tokenId, type: "refresh" },
      this.refreshSecret,
      { expiresIn: this.refreshExpire }
    );
  }

  verifyAccessToken(token) {
    return jwt.verify(token, this.accessSecret);
  }

  verifyRefreshToken(token) {
    return jwt.verify(token, this.refreshSecret);
  }

  async issueTokensForUser(user, previousTokenIdHash = null) {
    const refreshTokenId = createRefreshTokenId();
    const refreshTokenIdHash = hashTokenId(refreshTokenId);

    user.refreshTokens = (user.refreshTokens || []).filter(
      (item) => !item.revokedAt && new Date(item.expiresAt) > new Date()
    );

    if (previousTokenIdHash) {
      const previousToken = user.refreshTokens.find(
        (item) => item.tokenIdHash === previousTokenIdHash
      );

      if (previousToken) {
        previousToken.revokedAt = new Date();
        previousToken.replacedByTokenIdHash = refreshTokenIdHash;
      }
    }

    user.refreshTokens.push({
      tokenIdHash: refreshTokenIdHash,
      expiresAt: new Date(Date.now() + parseDurationMs(this.refreshExpire)),
    });

    await user.save();

    return {
      accessToken: this.createAccessToken(user),
      refreshToken: this.createRefreshToken(user._id.toString(), refreshTokenId),
    };
  }

  revokeRefreshTokenByHash(user, tokenIdHash) {
    user.refreshTokens = (user.refreshTokens || []).map((item) => {
      if (item.tokenIdHash === tokenIdHash && !item.revokedAt) {
        item.revokedAt = new Date();
      }
      return item;
    });
  }
}

module.exports = TokenManager;
