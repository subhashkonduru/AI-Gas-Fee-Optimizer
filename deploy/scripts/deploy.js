async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  const Greeter = await ethers.getContractFactory('Greeter');
  // ethers v6: deploy and wait for deployment
  const greeter = await Greeter.deploy('Gas Whisperer');
  await greeter.waitForDeployment();

  console.log('Greeter deployed to:', await greeter.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
