import React from 'react'
import TrendingTopics from '../Components/TrendingTopics'
import SuggestedFollows from '../Components/recommendation/SuggestedFollows'
import LeftNav from '../Components/LeftNav'
import { Link } from 'react-router-dom'
import { AiFillWindows } from "react-icons/ai";

// Career Paths Data
const careerPathsData = [
  {
    title: 'Administrator',
    description: 'Oversee and manage company-wide technical infrastructure.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/administrator',
    icon: "https://static.vecteezy.com/system/resources/thumbnails/005/877/546/small/app-development-modern-flat-concept-for-web-banner-design-male-designer-works-on-laptop-develops-usability-program-interface-and-places-menu-buttons-illustration-with-isolated-people-scene-vector.jpg"
  },
  {
    title: 'AI Engineer',
    description: 'Build and deploy cutting-edge artificial intelligence systems.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/ai-engineer',
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTnFF8i-GejB1BiU66EfUUZkZJui1R5ySCRig&s"
  },
  {
    title: 'App Maker',
    description: 'Create custom business applications for organizational needs.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/app-maker',
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSlOzXV9sVD70nJldo2SlxDy8bNnlxHZ_uivA&s"
  },
  {
    title: 'Business User',
    description: 'Improve productivity and business impact within a company.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/business-user',
    icon: "https://www.salesforce.com/blog/wp-content/uploads/sites/2/2023/06/Buyer-Persona.jpg?w=889"
  },
  {
    title: 'Data Analyst',
    description: 'Extract insights from data to support informed decision-making.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/data-analyst',
    icon: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ06T4uRrZp0LGl61KCifLqLquSkUyJQM6A9A&s"
  },
  {
    title: 'Data Engineer',
    description: 'Construct and maintain reliable data pipelines.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/data-engineer',
    icon: "https://media.istockphoto.com/id/1278527193/vector/vector-illustration-of-a-man-sitting-at-a-computer-a-system-administrator-in-a-data-center.jpg?s=612x612&w=0&k=20&c=w5XT-bIa4ceeHyVkBuomxW4qMWmi3sQC0XZ_9jzF_QY="
  },
  {
    title: 'Data Scientist',
    description: 'Discover patterns and insights using advanced data analysis.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/data-scientist',
    icon: "https://static.vecteezy.com/system/resources/thumbnails/005/877/715/small/science-research-modern-flat-concept-for-web-banner-design-scientist-studies-brain-and-analyzes-data-on-computer-screen-doing-neurobiology-research-illustration-with-isolated-people-scene-vector.jpg"
  },
  {
    title: 'Developer',
    description: 'Translate ideas into software through coding.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/developer',
    icon: "https://img.freepik.com/premium-vector/modern-web-developer-technology-icons-design-concept_1120563-26490.jpg"
  },
  {
    title: 'DevOps Engineer',
    description: 'Streamline software development and deployment processes.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/devops-engineer',
    icon: "https://media.istockphoto.com/id/1161702497/vector/team-of-programmer-concept-with-devops-software-development-practices-methodology-vector.jpg?s=612x612&w=0&k=20&c=5cqLQaudaYaXv3OdYQHjt-F-LhcuOiBhXWtHLMwj4PU="
  },
  {
    title: 'Functional Consultant',
    description: 'Implement business solutions using platform capabilities.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/functional-consultant',
    icon: "https://i0.wp.com/pjs.ecp.mybluehost.me//wp-content/uploads/2019/09/image.jpeg?resize=378%2C378&ssl=1"
  },
  {
    title: 'Identity and Access Administrator',
    description: 'Secure and manage user access across platforms.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/identity-and-access-admin',
    icon: "https://thumbs.dreamstime.com/b/manager-icon-administrator-364058042.jpg"
  },
  {
    title: 'Information Protection Administrator',
    description: 'Explore how Microsoft keeps customer data safe',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/information-protection-admin',
    icon: "https://static.vecteezy.com/system/resources/thumbnails/011/431/951/small/privacy-policy-official-document-information-in-form-of-text-customer-database-information-about-companys-clients-who-made-transactions-protecting-your-privacy-flat-modern-illustration-vector.jpg"
  },
  {
    title: 'Security Engineer',
    description: 'Protect digital environments from potential threats.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/security-engineer',
    icon: "https://static.vecteezy.com/system/resources/thumbnails/038/490/863/small/server-maintenance-with-monitoring-tools-concept-managed-server-service-solution-flat-modern-illustration-vector.jpg"
  },
  {
    title: 'Security Operations Analyst',
    description: 'Proactively monitor and maintain security posture.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/security-operations-analyst',
    icon: "https://ossisto.com/wp-content/uploads/2024/04/Security-Operations-Analyst-1.webp"
  },
  {
    title: 'Solutions Architect',
    description: 'Design comprehensive technical solutions for organizations.',
    link: 'https://learn.microsoft.com/en-us/training/career-paths/solution-architect',
    icon: "https://media.istockphoto.com/id/1355483012/vector/open-automation-architecture-abstract-concept-vector-illustration.jpg?s=612x612&w=0&k=20&c=30UWCfztW8eHAL4l-GRfbs1zB0t4yjXuOPyi9Ak45kM="
  },
];

const Career_Paths = () => {
  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="flex flex-col md:flex-row justify-center">
        <aside className="sm:items-center sm:justify-center md:block md:w-66 p-4 lg:h-[560px]">
          <div className="bg-white rounded-lg shadow p-4 h-full">
            <LeftNav />
          </div>
        </aside>

        <main className="w-full md:w-[600px] lg:w-[700px] p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {careerPathsData.map((career) => (
              <Link to={career.link} key={career.title} className="group">
                <div className="relative w-full h-64 bg-[#15151A] rounded-lg shadow-lg 
                  hover:shadow-2xl transition-all duration-300 
                  transform hover:-translate-y-1 hover:scale-105 
                  cursor-pointer text-white">
                  
                  {/* Image Section: 50% height, full width with lazy loading */}
                  <div className="h-1/2 w-full">
                    <img 
                      src={career.icon} 
                      alt={career.title} 
                      className="w-full h-full object-cover rounded-t-lg" 
                      loading="lazy" 
                    />
                  </div>

                  {/* Content Section (Remaining 50% Height) */}
                  <div className="h-1/2 p-4 flex flex-col justify-center items-center">
                    <h2 className="text-lg font-semibold text-purple-300 text-center">
                      {career.title}
                    </h2>
                    <p className="text-gray-400 text-sm text-center">
                      {career.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {/* Microsoft reference link */}
          <div className="mt-8 flex justify-center">
            <Link
              to={"https://learn.microsoft.com/en-us/training/career-paths"}
              // target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 p-3 bg-white rounded-full shadow hover:shadow-lg hover:translate-y-1 hover:bg-gray-300 transition duration-300"
            >
              <AiFillWindows className="text-blue-600 text-3xl" />
              <span className="hidden sm:inline text-gray-800 font-medium">
                Microsoft
              </span>
            </Link>
          </div>

        </main>

        <aside className="hidden lg:block w-[350px] p-4">
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <TrendingTopics />
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <SuggestedFollows />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Career_Paths
