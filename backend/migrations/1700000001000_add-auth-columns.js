exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("stores", {
    api_key_hash: { type: "text" },
  });
  pgm.addColumn("couriers", {
    password_hash: { type: "text" },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("stores", "api_key_hash");
  pgm.dropColumn("couriers", "password_hash");
};
